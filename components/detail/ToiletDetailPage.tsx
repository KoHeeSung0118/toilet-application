'use client';

import './DetailPage.css';
import PaperRequestForm from '@/components/detail/PaperRequestForm';
import DeleteCommentButton from './DeleteCommentButton';
import FavoriteButton from '@/components/favorite/FavoriteButton';
import ClientOnlyBackButton from './ClientOnlyBackButton';
import DirectionsButton from '@/components/detail/DirectionsButton';
import { useCallback, useEffect, useState } from 'react';
import io, { Socket } from 'socket.io-client';

/* ---------------------------- 타입 ---------------------------- */
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
  currentUserId: string; // 로그인 강제 가정(미들웨어)
  toilet: Toilet;
}

interface ActiveSignal {
  _id: string;
  toiletId: string;
  lat: number;
  lng: number;
  message?: string;
  userId: string;                  // 요청자
  acceptedByUserId?: string | null;// 구원자
  createdAt: string;
  expiresAt: string;
}

/* --------------------------- 컴포넌트 -------------------------- */
export default function ToiletDetailPage({
  id,
  placeName = '',
  from = '',
  currentUserId,
  toilet,
}: ToiletDetailPageProps) {
  const rating = typeof toilet.overallRating === 'number' ? toilet.overallRating : 3;
  const encodedName = encodeURIComponent(placeName || toilet.place_name || '');

  /* ---------------------- 활성 신호 상태 ---------------------- */
  const [activeSignals, setActiveSignals] = useState<ActiveSignal[]>([]);
  const [tick, setTick] = useState(0); // 1초 리렌더링용

  // 남은 시간 포맷
  const timeLeft = (expiresAt: string) => {
    const ms = new Date(expiresAt).getTime() - Date.now();
    if (ms <= 0) return '만료';
    const s = Math.floor(ms / 1000);
    const m = Math.floor(s / 60);
    const rs = s % 60;
    return m > 0 ? `${m}분 ${rs}초 남음` : `${rs}초 남음`;
  };

  // 1초마다 강제 리렌더(남은시간 갱신)
  useEffect(() => {
    const t = window.setInterval(() => setTick(v => v + 1), 1000);
    return () => window.clearInterval(t);
  }, []);

  // 서버에서 최신 요청 가져오기
  const fetchActive = useCallback(async () => {
    try {
      const resp = await fetch(`/api/signal/active?toiletIds=${encodeURIComponent(id)}`, { cache: 'no-store' });
      if (!resp.ok) return;
      const data = (await resp.json()) as { ok?: true; items?: ActiveSignal[] };
      const items = (data.items ?? []).filter((s) => {
        // 수락된 요청은 요청자/구원자만 보이게(지도에서는 소켓/캐치업으로 처리)
        if (s.acceptedByUserId && s.acceptedByUserId !== currentUserId && s.userId !== currentUserId) {
          return false;
        }
        return true;
      });
      setActiveSignals(items);
    } catch {
      // ignore
    }
  }, [currentUserId, id]);

  // 소켓 연결 + 방 조인 + 이벤트 수신시 즉시 갱신(추가로 5초 폴백 폴링)
  useEffect(() => {
    let s: Socket | null = null;
    let pollId: number | null = null;

    (async () => {
      await fetch('/api/socketio-init', { cache: 'no-store' }).catch(() => {});
      s = io({ path: '/api/socket', transports: ['websocket'] });

      const refetch = () => fetchActive();

      s.on('connect', () => {
        s!.emit('join_toilet', id);
      });

      // 서버가 통일해서 쏘는 단일 이벤트
      s.on('signals_changed', (p: { toiletId?: string }) => {
        if (p?.toiletId === String(id)) refetch();
      });

      // 혹시 다른 이벤트명이 섞여 있더라도 모두 캐치(안전망)
      s.onAny((evt) => {
        const e = String(evt);
        if (e.startsWith('paper_') || e.startsWith('signal_')) {
          refetch();
        }
      });

      // 폴백 폴링(5초마다)
      pollId = window.setInterval(refetch, 5000);
    })();

    // 첫 로드 페치
    fetchActive();

    return () => {
      if (pollId) window.clearInterval(pollId);
      if (!s) return;
      s.emit('leave_toilet', id);
      s.removeAllListeners();
      s.disconnect();
    };
  }, [id, fetchActive]);

  // “누가 수락했는지” 표시
  function acceptedLabel(sig: ActiveSignal): string {
    if (!sig.acceptedByUserId) return '';
    if (sig.acceptedByUserId === currentUserId) return '내가 가는 중';
    const short = sig.acceptedByUserId.slice(-4);
    return `구원자: ****${short}`;
  }

  const isMine = (sig: ActiveSignal) => sig.userId === currentUserId;
  const isAcceptedByMe = (sig: ActiveSignal) => sig.acceptedByUserId === currentUserId;

  /* ----------------------- 액션 핸들러 ------------------------ */
  // 갈게요(낙관적 업데이트 → 실패 시 롤백)
  async function accept(signalId: string) {
    const prev = activeSignals;
    const optimistic = prev.map(s => s._id === signalId
      ? { ...s, acceptedByUserId: currentUserId, expiresAt: new Date(Date.now() + 30 * 60 * 1000).toISOString() }
      : s
    );
    setActiveSignals(optimistic);

    const r = await fetch('/api/signal/accept', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ signalId }),
    });

    if (!r.ok) {
      setActiveSignals(prev); // 롤백
      const e = (await r.json().catch(() => ({}))) as { error?: string };
      alert(e.error ?? '수락 실패');
      return;
    }
    // 서버에서 signals_changed가 오므로 별도 처리 없어도 갱신됨(안전하게 한번 더)
    fetchActive();
  }

  // 갈게요 취소
  async function cancelAccept(signalId: string) {
    const prev = activeSignals;
    const optimistic = prev.map(s => s._id === signalId
      ? { ...s, acceptedByUserId: null, expiresAt: new Date(Date.now() + 10 * 60 * 1000).toISOString() }
      : s
    );
    setActiveSignals(optimistic);

    const r = await fetch('/api/signal/accept-cancel', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ signalId }),
    });

    if (!r.ok) {
      setActiveSignals(prev);
      const e = (await r.json().catch(() => ({}))) as { error?: string };
      alert(e.error ?? '취소 실패');
      return;
    }
    fetchActive();
  }

  // 요청자가 자기 글 삭제
  async function cancelRequest(signalId: string) {
    const prev = activeSignals;
    const optimistic = prev.filter(s => s._id !== signalId);
    setActiveSignals(optimistic);

    const r = await fetch('/api/signal/cancel', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ signalId }),
    });

    if (!r.ok) {
      setActiveSignals(prev);
      const e = (await r.json().catch(() => ({}))) as { error?: string };
      alert(e.error ?? '요청 취소 실패');
      return;
    }
    fetchActive();
  }

  /* --------------------------- 렌더 --------------------------- */
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

        {/* 기본 액션(휴지요청은 독립 카드로 분리) */}
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

      {/* 활성 요청 목록 */}
      {activeSignals.length > 0 && (
        <div className="active-requests">
          <div className="active-title">요청 신호</div>
          <ul className="active-list">
            {activeSignals
              .filter((s) => {
                // 수락된 요청은 요청자/구원자만 보이도록 클라에서도 한 번 더 필터
                if (s.acceptedByUserId && s.acceptedByUserId !== currentUserId && s.userId !== currentUserId) {
                  return false;
                }
                return true;
              })
              .map((s) => (
                <li key={s._id} className="active-item">
                  <div className="active-msg">
                    {s.message ?? '메시지 없음'}
                    {s.acceptedByUserId && (
                      <div style={{ color: '#4E3CDB', fontWeight: 600, marginTop: 4 }}>
                        {acceptedLabel(s)}
                      </div>
                    )}
                  </div>

                  {/* 오른쪽: 남은 시간(왼쪽) + 버튼(오른쪽) */}
                  <div className="active-meta" style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <span aria-label="남은시간">{timeLeft(s.expiresAt)}</span>

                    {/* 버튼 영역 */}
                    <div style={{ display: 'flex', gap: 6 }}>
                      {/* 내 글이면 '요청 취소' */}
                      {isMine(s) && (
                        <button
                          type="button"
                          className="action-btn"
                          onClick={() => cancelRequest(s._id)}
                          aria-label="요청 취소"
                        >
                          요청 취소
                        </button>
                      )}
                      {/* 내 글이 아니고, 아직 수락자 없으면 '갈게요' */}
                      {!isMine(s) && !s.acceptedByUserId && (
                        <button
                          type="button"
                          className="action-btn"
                          onClick={() => accept(s._id)}
                          aria-label="갈게요"
                        >
                          갈게요
                        </button>
                      )}
                      {/* 내가 수락자면 '갈게요 취소' */}
                      {isAcceptedByMe(s) && (
                        <button
                          type="button"
                          className="action-btn"
                          onClick={() => cancelAccept(s._id)}
                          aria-label="갈게요 취소"
                        >
                          갈게요 취소
                        </button>
                      )}
                    </div>
                  </div>
                </li>
              ))}
          </ul>
        </div>
      )}

      {/* 휴지 요청: 독립 카드 */}
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
            <span key={idx} className="tag">#{kw}</span>
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
            .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
            .map((r) => (
              <div key={r._id} className="comment-item">
                <div className="comment-content">
                  <div className="comment-main">
                    <strong className="nickname">{r.nickname}</strong>
                    <span className="comment-text">{r.comment}</span>
                  </div>
                  <div className="comment-right">
                    <span className="comment-date">
                      {(() => {
                        const now = Date.now();
                        const then = new Date(r.createdAt).getTime();
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
                      })()}
                    </span>
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

      <a
        className="comment-btn"
        href={`/toilet/${id}/comment?place_name=${encodedName}${from ? `&from=${from}` : ''}`}
      >
        댓글 추가하기
      </a>
    </div>
  );
}
