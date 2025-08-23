'use client';

import './DetailPage.css';
import PaperRequestForm from '@/components/detail/PaperRequestForm';
import DeleteCommentButton from './DeleteCommentButton';
import FavoriteButton from '@/components/favorite/FavoriteButton';
import ClientOnlyBackButton from './ClientOnlyBackButton';
import DirectionsButton from '@/components/detail/DirectionsButton';
import { useCallback, useEffect, useMemo, useState } from 'react';
import io from 'socket.io-client';

/* --------------------------------------------------------
 * 타입 정의 (MongoDB _id 유지)
 * ------------------------------------------------------*/
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

interface ToiletDetailPageProps {
  id: string;
  placeName?: string;
  from?: string;
  /** 로그인 강제 전제 */
  currentUserId: string;
  toilet: Toilet;
}

interface ActiveSignal {
  _id: string;
  toiletId: string;
  lat: number;
  lng: number;
  message?: string;
  userId: string;                  // 요청자
  acceptedByUserId: string | null; // 구원자
  createdAt: string;
  expiresAt: string;
}

export default function ToiletDetailPage({
  id,
  placeName = '',
  from = '',
  currentUserId,
  toilet,
}: ToiletDetailPageProps) {
  const rating = typeof toilet.overallRating === 'number' ? toilet.overallRating : 3;
  const encodedName = encodeURIComponent(placeName || toilet.place_name || '');

  /* -------------------- 유틸 -------------------- */
  const formatTimeAgo = (date: string | Date) => {
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

  const timeLeft = (expiresAt: string) => {
    const ms = new Date(expiresAt).getTime() - Date.now();
    if (ms <= 0) return '만료';
    const s = Math.floor(ms / 1000);
    const m = Math.floor(s / 60);
    const rs = s % 60;
    return m > 0 ? `${m}분 ${rs}초 남음` : `${rs}초 남음`;
  };

  /* -------------------- 상태 -------------------- */
  const [activeSignals, setActiveSignals] = useState<ActiveSignal[]>([]);
  // 1초마다 남은 시간 갱신용 강제 리렌더
  const [, force] = useState(0);
  useEffect(() => {
    const t = setInterval(() => force((n) => n + 1), 1000);
    return () => clearInterval(t);
  }, []);

  /* -------------------- 서버 조회 -------------------- */
  const fetchActive = useCallback(async () => {
    const resp = await fetch(`/api/signal/active?toiletIds=${encodeURIComponent(id)}`, { cache: 'no-store' });
    if (!resp.ok) return;
    const data = (await resp.json()) as { ok?: true; items?: ActiveSignal[] };
    setActiveSignals(data.items ?? []);
  }, [id]);

  /* -------------------- 소켓 연결 -------------------- */
  useEffect(() => {
    // 최초 로드
    fetchActive();

    // 서버의 Socket.IO 인스턴스 보장
    fetch('/api/socketio-init').finally(() => {
      const s = io({ path: '/api/socket', transports: ['websocket'] });

      const refetch = () => fetchActive();

      s.on('connect', () => s.emit('join_toilet', id));
      // 서버가 브로드캐스트하는 모든 신호 변경 이벤트에서 즉시 재조회
      s.on('signals_changed', refetch);
      s.on('paper_request', refetch);
      s.on('paper_accepted', refetch);
      s.on('paper_accept_canceled', refetch);
      s.on('paper_canceled', refetch);

      return () => {
        s.off('signals_changed', refetch);
        s.off('paper_request', refetch);
        s.off('paper_accepted', refetch);
        s.off('paper_accept_canceled', refetch);
        s.off('paper_canceled', refetch);
        s.emit('leave_toilet', id);
        s.disconnect();
      };
    });
  }, [id, fetchActive]);

  /* -------------------- 도우미 -------------------- */
  const isMine = useCallback((sig: ActiveSignal) => sig.userId === currentUserId, [currentUserId]);
  const acceptedByMe = useCallback((sig: ActiveSignal) => sig.acceptedByUserId === currentUserId, [currentUserId]);

  const acceptedLabel = (sig: ActiveSignal): string => {
    if (!sig.acceptedByUserId) return '';
    if (sig.acceptedByUserId === currentUserId) return '내가 가는 중';
    if (sig.userId === currentUserId) return '구원자가 가는 중';
    const short = sig.acceptedByUserId.slice(-4);
    return `구원자: ****${short}`;
  };

  /* -------------------- 액션 (옵티미스틱) -------------------- */
  const accept = useCallback(async (signalId: string) => {
    const r = await fetch('/api/signal/accept', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ signalId }),
    });
    if (!r.ok) {
      const e = (await r.json().catch(() => ({}))) as { error?: string };
      alert(e.error ?? '수락 실패');
      return;
    }
    // 옵티미스틱: 바로 내 것으로 표시
    setActiveSignals((prev) =>
      prev.map((s) => (s._id === signalId ? { ...s, acceptedByUserId: currentUserId } : s))
    );
  }, [currentUserId]);

  const cancelAccept = useCallback(async (signalId: string) => {
    const r = await fetch('/api/signal/accept-cancel', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ signalId }),
    });
    if (!r.ok) {
      const e = (await r.json().catch(() => ({}))) as { error?: string };
      alert(e.error ?? '취소 실패');
      return;
    }
    setActiveSignals((prev) =>
      prev.map((s) => (s._id === signalId ? { ...s, acceptedByUserId: null } : s))
    );
  }, []);

  const cancelMine = useCallback(async (signalId: string) => {
    const r = await fetch('/api/signal/cancel', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ signalId }),
    });
    if (!r.ok) {
      const e = (await r.json().catch(() => ({}))) as { error?: string };
      alert(e.error ?? '요청 취소 실패');
      return;
    }
    setActiveSignals((prev) => prev.filter((s) => s._id !== signalId));
  }, []);

  /* -------------------- 렌더 -------------------- */
  return (
    <div className="detail-page">
      <ClientOnlyBackButton />

      {/* 헤더 */}
      <div className="detail-header">
        <div className="favorite-wrapper">
          <FavoriteButton toiletId={id} placeName={toilet.place_name} />
        </div>
        <h2>{toilet.place_name}</h2>
        <div className="rating">
          {'★'.repeat(Math.round(rating)).padEnd(5, '☆')} ({rating.toFixed(1)})
        </div>

        <div className="btn-group">
          <a href={`/toilet/${id}/keywords?place_name=${encodedName}${from ? `&from=${from}` : ''}`}>
            키워드 추가하기
          </a>
          <a href={`/toilet/${id}/rate?place_name=${encodedName}${from ? `&from=${from}` : ''}`}>
            별점 추가하기
          </a>
          <DirectionsButton placeName={toilet.place_name} lat={toilet.lat} lng={toilet.lng} />
        </div>
      </div>

      {/* 활성 요청 박스 (서버에서 가시성 필터됨) */}
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

                {/* 남은 시간 → 버튼 왼쪽에 배치 */}
                <div className="active-meta" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span>{timeLeft(s.expiresAt)}</span>

                  {/* 내 글: '요청 취소'만 */}
                  {isMine(s) && (
                    <button className="action-btn" onClick={() => cancelMine(s._id)}>
                      요청 취소
                    </button>
                  )}

                  {/* 남의 글: '갈게요' / '갈게요 취소' */}
                  {!isMine(s) && !s.acceptedByUserId && (
                    <button className="action-btn" onClick={() => accept(s._id)}>
                      갈게요
                    </button>
                  )}
                  {!isMine(s) && acceptedByMe(s) && (
                    <button className="action-btn" onClick={() => cancelAccept(s._id)}>
                      갈게요 취소
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* 휴지 요청 독립 카드 */}
      <div className="request-card">
        <div className="request-title">휴지 요청 보내기</div>
        <div className="request-row">
          <PaperRequestForm
            toiletId={id}
            lat={toilet.lat}
            lng={toilet.lng}
            userId={currentUserId}
            onCreated={fetchActive}
          />
        </div>
        <div className="request-hint">예: 남자 화장실 2번째 칸입니다. (최대 120자)</div>
      </div>

      {/* 사용자들의 평균 점수 */}
      <div className="tags-box">
        사용자들의 평균 점수
        <div>청결: {toilet.cleanliness}점</div>
        <div>시설: {toilet.facility}점</div>
        <div>편의: {toilet.convenience}점</div>
      </div>

      {/* 키워드 */}
      {toilet.keywords?.length ? (
        <div className="keyword-box">
          {toilet.keywords.map((kw, idx) => (
            <span key={idx} className="tag">
              #{kw}
            </span>
          ))}
        </div>
      ) : (
        <div className="keyword-box">
          <p style={{ marginTop: '1rem' }}>등록된 키워드가 없습니다.</p>
        </div>
      )}

      {/* 댓글 */}
      <div className="reviews">
        <h3>댓글</h3>
        {toilet.reviews?.length ? (
          toilet.reviews
            .sort(
              (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
            )
            .map((r) => (
              <div key={r._id} className="comment-item">
                <div className="comment-content">
                  <div className="comment-main">
                    <strong className="nickname">{r.nickname}</strong>
                    <span className="comment-text">{r.comment}</span>
                  </div>

                  <div className="comment-right">
                    <span className="comment-date">{formatTimeAgo(r.createdAt)}</span>
                    {r.userId === currentUserId && (
                      <DeleteCommentButton toiletId={id} commentId={r._id} />
                    )}
                  </div>
                </div>
              </div>
            ))
        ) : (
          <p>아직 등록된 댓글이 없습니다.</p>
        )}
      </div>

      {/* 댓글 작성 버튼 */}
      <a
        className="comment-btn"
        href={`/toilet/${id}/comment?place_name=${encodedName}${from ? `&from=${from}` : ''}`}
      >
        댓글 추가하기
      </a>
    </div>
  );
}
