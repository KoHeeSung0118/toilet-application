'use client'; // 이 파일은 클라이언트 컴포넌트(브라우저에서 실행)

import './DetailPage.css';
import PaperRequestForm from '@/components/detail/PaperRequestForm';
import DeleteCommentButton from './DeleteCommentButton';
import FavoriteButton from '@/components/favorite/FavoriteButton';
import ClientOnlyBackButton from './ClientOnlyBackButton';
import DirectionsButton from '@/components/detail/DirectionsButton';
import { useCallback, useEffect, useRef, useState } from 'react';
import { getPusher } from '@/lib/pusher-client';
import type { Channel } from 'pusher-js';

/**
 * Toilet: 상세 화면에서 보여줄 화장실 정보 타입
 * - 서버에서 받은 데이터가 이 구조를 따른다고 가정
 */
interface Toilet {
  _id: string;
  place_name: string;
  lat: number;
  lng: number;
  keywords?: string[];
  reviews?: {
    _id: string;
    userId: string;
    nickname: string;
    comment: string;
    createdAt: string | Date;
  }[];
  cleanliness?: number;
  facility?: number;
  convenience?: number;
  overallRating?: number;
}

/**
 * 페이지 컴포넌트가 받는 props
 * - id: 현재 상세 페이지의 화장실 ID
 * - currentUserId: 현재 로그인한 사용자 ID
 * - toilet: 화면에 그릴 화장실 데이터
 * - placeName/from: 라우팅/표시 편의를 위해 추가로 받음
 */
interface ToiletDetailPageProps {
  id: string;
  placeName?: string;
  from?: string;
  currentUserId: string;
  toilet: Toilet;
}

/**
 * ActiveSignal: "휴지 요청" 카드의 데이터 구조
 * - expiresAt: 만료시각(이후 '만료' 처리)
 * - acceptedByUserId: 누가 수락했는지 (null이면 아직 미수락)
 */
interface ActiveSignal {
  _id: string;
  toiletId: string;
  lat: number;
  lng: number;
  message?: string;
  userId: string;
  acceptedByUserId?: string | null;
  createdAt: string;
  expiresAt: string;
}

/**
 * PaperEvent: Pusher로 수신하는 이벤트 페이로드의 타입
 * - 여기서는 서버가 emit하는 payload가 ActiveSignal과 동일하므로 재사용
 */
type PaperEvent = ActiveSignal;

export default function ToiletDetailPage({
  id,
  placeName = '',
  from = '',
  currentUserId,
  toilet,
}: ToiletDetailPageProps) {
  // 별점 표시용 숫자 (없으면 기본 3점으로 표시)
  const rating = typeof toilet.overallRating === 'number' ? toilet.overallRating : 3;
  const encodedName = encodeURIComponent(placeName || toilet.place_name || '');

  // 요청 카드 리스트 상태 (실시간/서버재조회로 계속 갱신됨)
  const [activeSignals, setActiveSignals] = useState<ActiveSignal[]>([]);
  // 현재 구독 중인 Pusher 채널 객체를 기억해 두는 ref (언마운트 때 해제에 사용)
  const channelRef = useRef<Channel | null>(null);

  /**
   * 화면 내 '남은 시간' 표시를 1초마다 재계산하기 위한 틱(state)
   * - 렌더만 유도하는 용도이며 실제 데이터는 바뀌지 않음
   */
  const [, forceTick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => forceTick((v) => v + 1), 1000);
    return () => clearInterval(t); // 언마운트 시 인터벌 정리
  }, []);

  /**
   * expiresAt까지 남은 시간을 "n분 n초 남음" 형태로 문자열 변환
   * - 만료 시 '만료' 반환
   */
  const timeLeft = (expiresAt: string): string => {
    const ms = new Date(expiresAt).getTime() - Date.now();
    if (ms <= 0) return '만료';
    const s = Math.floor(ms / 1000);
    const m = Math.floor(s / 60);
    const rs = s % 60;
    return m > 0 ? `${m}분 ${rs}초 남음` : `${rs}초 남음`;
  };

  // 내가 만든 요청인가?
  const isMine = (sig: ActiveSignal) => sig.userId === currentUserId;
  // 내가 수락한 요청인가?
  const isAcceptedByMe = (sig: ActiveSignal) => sig.acceptedByUserId === currentUserId;

  /**
   * acceptedByUserId 라벨 표시 텍스트
   * - 내가 수락했다면 '내가 가는 중'
   * - 남이 수락했다면 뒷 4자리만 마스킹해서 표기
   */
  const acceptedLabel = (sig: ActiveSignal): string => {
    if (!sig.acceptedByUserId) return '';
    if (isAcceptedByMe(sig)) return '내가 가는 중';
    const short = sig.acceptedByUserId.slice(-4);
    return `구원자: ****${short}`;
  };

  /**
   * 서버에서 현재 활성 신호를 조회
   * - /api/signal/active?toiletIds={id}
   * - 응답 items를 시간순으로 정렬하여 상태에 반영
   */
  const fetchActive = useCallback(async () => {
    try {
      const resp = await fetch(`/api/signal/active?toiletIds=${encodeURIComponent(id)}`, { cache: 'no-store' });
      if (!resp.ok) return;
      const data = (await resp.json()) as { ok?: true; items?: ActiveSignal[] };
      setActiveSignals(
        (data.items ?? []).sort(
          (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        )
      );
    } catch {
      /* 네트워크 오류 등은 무시 */
    }
  }, [id]);

  // =========================
  //   Pusher 구독(useEffect)
  // =========================
  useEffect(() => {
    let isUnmounted = false; // 언마운트 이후 동작 방지용 플래그

    const boot = async () => {
      // 1) 첫 로딩 시 서버에서 현재 활성 신호들 가져오기
      await fetchActive();
      if (isUnmounted) return;

      // 2) Pusher 클라이언트 생성 후 특정 화장실 채널 구독 (toilet-{id})
      const pusher = getPusher(); // 클라용 pusher 인스턴스 (키/클러스터 등은 다른 파일에서 설정)
      const ch = pusher.subscribe(`toilet-${id}`);
      channelRef.current = ch;

      // 3) 서버가 emit한 'paper_request' 이벤트를 즉시 화면에 반영
      //    - 같은 _id가 이미 있으면 교체, 없으면 맨 앞에 추가
      ch.bind('paper_request', (payload: PaperEvent) => {
        setActiveSignals((prev) => [payload, ...prev.filter((x) => x._id !== payload._id)]);
      });

      // 4) 수락/취소 등 상태 변화 이벤트는 refetch로 서버 진실을 다시 반영
      const refetch = () => fetchActive();
      ch.bind('paper_accepted', refetch);
      ch.bind('paper_accept_canceled', refetch);
      ch.bind('paper_canceled', refetch);
      ch.bind('paper_unaccepted', refetch);
      ch.bind('signals_changed', refetch); // 전역 신호도 동일하게 재조회
    };

    void boot();

    return () => {
      // 언마운트 시: 바인딩 해제 및 채널 구독 취소(메모리 누수/중복 수신 방지)
      isUnmounted = true;
      const ch = channelRef.current;
      if (ch) {
        ch.unbind_all();
        ch.pusher.unsubscribe(ch.name);
        channelRef.current = null;
      }
    };
  }, [id, fetchActive]);

  /**
   * 보조 폴링: 화면에 카드가 하나 이상 있을 때 3초마다 재조회
   * - 만료/수락/취소 등 빠르게 일어나는 변화를 서버 기준으로 정합성 유지
   * - 실시간(Pusher) + 폴링(fetchActive) 혼합 전략
   */
  useEffect(() => {
    if (activeSignals.length === 0) return;
    const t = setInterval(fetchActive, 3000);
    return () => clearInterval(t);
  }, [activeSignals.length, fetchActive]);

  /**
   * "갈께요"(수락) 동작
   * - 간단한 낙관적 반영(라벨 체감용) 후 실패 시 롤백, 성공 시 재조회
   *   ※ 요청 카드 생성은 낙관적 처리하지 않습니다.
   */
  async function accept(signalId: string) {
    const rollback = activeSignals;
    setActiveSignals((prev) =>
      prev.map((s) => (s._id === signalId ? { ...s, acceptedByUserId: currentUserId } : s))
    );

    const r = await fetch('/api/signal/accept', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ signalId }),
      credentials: 'same-origin',
    });

    if (!r.ok) {
      setActiveSignals(rollback);
      const e = (await r.json().catch(() => ({}))) as { error?: string };
      alert(e.error ?? '수락 실패');
      return;
    }
    fetchActive();
  }

  /**
   * "갈께요 취소" 동작
   * - 간단한 낙관적 반영 후 실패 시 롤백, 성공 시 재조회
   */
  async function cancelAccept(signalId: string) {
    const rollback = activeSignals;
    setActiveSignals((prev) =>
      prev.map((s) => (s._id === signalId ? { ...s, acceptedByUserId: null } : s))
    );

    const r = await fetch('/api/signal/accept-cancel', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ signalId }),
      credentials: 'same-origin',
    });

    if (!r.ok) {
      setActiveSignals(rollback);
      const e = (await r.json().catch(() => ({}))) as { error?: string };
      alert(e.error ?? '취소 실패');
      return;
    }
    fetchActive();
  }

  /**
   * "내 요청 취소" 동작
   * - 간단한 낙관적 제거 후 실패 시 롤백, 성공 시 재조회
   */
  async function cancelMyRequest(signalId: string) {
    const rollback = activeSignals;
    setActiveSignals((prev) => prev.filter((s) => s._id !== signalId));

    const r = await fetch('/api/signal/cancel', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ signalId }),
      credentials: 'same-origin',
    });
    if (!r.ok) {
      setActiveSignals(rollback);
      const e = (await r.json().catch(() => ({}))) as { error?: string };
      alert(e.error ?? '요청 취소 실패');
      return;
    }
    fetchActive();
  }

  /**
   * 댓글 시간 표시용 "n분 전" 계산
   */
  const formatTimeAgo = (date: string | Date): string => {
    const now = Date.now();
    const then = new Date(date).getTime();
    const diffSec = Math.floor((now - then) / 1000);
    if (diffSec < 60) return `${diffSec}초 전`;
    const diffMin = Math.floor(diffSec / 60);
    if (diffMin < 60) return `${diffMin}분 전`;
    const diffHour = Math.floor(diffMin / 60);
    if (diffHour < 24) return `${diffHour}시간 전`;
    const diffDay = Math.floor(diffHour / 24);
    if (diffDay < 30) return `${diffDay}일 전`;
    const diffMonth = Math.floor(diffDay / 30);
    if (diffMonth < 12) return `${diffMonth}개월 전`;
    const diffYear = Math.floor(diffDay / 365);
    return `${diffYear}년 전`;
  };

  // =========================
  //          렌더링
  // =========================
  return (
    <div className="detail-page">
      <ClientOnlyBackButton />
      <div className="detail-header">
        <div className="favorite-wrapper">
          <FavoriteButton toiletId={id} placeName={toilet.place_name} />
        </div>
        <h2>{toilet.place_name}</h2>
        <div className="rating">
          {'★'.repeat(Math.round(rating)).padEnd(5, '☆')} ({rating.toFixed(1)})
        </div>
        <div className="btn-group">
          {/* 키워드/별점 페이지로 이동하는 링크들 */}
          <a href={`/toilet/${id}/keywords?place_name=${encodedName}${from ? `&from=${from}` : ''}`}>키워드 추가하기</a>
          <a href={`/toilet/${id}/rate?place_name=${encodedName}${from ? `&from=${from}` : ''}`}>별점 추가하기</a>
          {/* 길찾기 버튼(외부 지도 앱/링크로 이동) */}
          <DirectionsButton placeName={toilet.place_name} lat={toilet.lat} lng={toilet.lng} />
        </div>
      </div>

      {/* 활성 요청 리스트가 있을 때만 표시 */}
      {activeSignals.length > 0 && (
        <div className="active-requests">
          <div className="active-title">요청 신호</div>
          <ul className="active-list">
            {activeSignals.map((s) => (
              <li key={s._id} className="active-item">
                <div className="active-msg">
                  {s.message ?? '메시지 없음'}
                  {s.acceptedByUserId && (
                    <div style={{ color: '#4E3CDB', fontWeight: 600, marginTop: 4 }}>
                      {acceptedLabel(s)}
                    </div>
                  )}
                </div>
                <div className="active-meta" style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <span>{timeLeft(s.expiresAt)}</span>
                  {/* 내 요청이면 '요청 취소' 버튼 노출 */}
                  {isMine(s) && (
                    <button className="action-btn" onClick={() => cancelMyRequest(s._id)}>
                      요청 취소
                    </button>
                  )}
                  {/* 남의 요청이고 아직 수락자가 없으면 '갈께요' 버튼 */}
                  {!isMine(s) && !s.acceptedByUserId && (
                    <button className="action-btn" onClick={() => accept(s._id)}>
                      갈께요
                    </button>
                  )}
                  {/* 남의 요청인데 내가 수락한 상태면 '갈께요 취소' 버튼 */}
                  {!isMine(s) && isAcceptedByMe(s) && (
                    <button className="action-btn" onClick={() => cancelAccept(s._id)}>
                      갈께요 취소
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* 휴지 요청 보내기 카드: 폼은 서버 호출만, 카드는 이벤트로만 추가 */}
      <div className="request-card">
        <div className="request-title">휴지 요청 보내기</div>
        <div className="request-row">
          <PaperRequestForm
            toiletId={id}
            lat={toilet.lat}
            lng={toilet.lng}
            userId={currentUserId}
          />
        </div>
        <div className="request-hint">요청은 전송 후 “실시간 이벤트 수신” 시 카드로 표시됩니다.</div>
      </div>

      {/* 평균 점수 표시 */}
      <div className="tags-box">
        사용자들의 평균 점수
        <div>청결: {toilet.cleanliness}점</div>
        <div>시설: {toilet.facility}점</div>
        <div>편의: {toilet.convenience}점</div>
      </div>

      {/* 키워드 태그들 */}
      {toilet.keywords?.length ? (
        <div className="keyword-box">
          {toilet.keywords.map((kw, idx) => (
            <span key={idx} className="tag">#{kw}</span>
          ))}
        </div>
      ) : (
        <div className="keyword-box">
          <p style={{ marginTop: '1rem' }}>등록된 키워드가 없습니다.</p>
        </div>
      )}

      {/* 댓글 목록 */}
      <div className="reviews">
        <h3>댓글</h3>
        {toilet.reviews?.length ? (
          toilet.reviews
            .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
            .map((r) => (
              <div key={r._id} className="comment-item">
                <div className="comment-content">
                  <div className="comment-main">
                    <strong className="nickname">{r.nickname}</strong>
                    <span className="comment-text">{r.comment}</span>
                  </div>
                  <div className="comment-right">
                    <span className="comment-date">{formatTimeAgo(r.createdAt)}</span>
                    {/* 내 댓글이면 삭제 버튼 노출 */}
                    {r.userId === currentUserId && <DeleteCommentButton toiletId={id} commentId={r._id} />}
                  </div>
                </div>
              </div>
            ))
        ) : (
          <p>아직 등록된 댓글이 없습니다.</p>
        )}
      </div>

      {/* 댓글 작성 페이지로 이동 */}
      <a className="comment-btn" href={`/toilet/${id}/comment?place_name=${encodedName}${from ? `&from=${from}` : ''}`}>
        댓글 추가하기
      </a>
    </div>
  );
}
