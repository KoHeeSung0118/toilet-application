'use client';

import './DetailPage.css';
import PaperRequestForm from '@/components/detail/PaperRequestForm';
import DeleteCommentButton from './DeleteCommentButton';
import FavoriteButton from '@/components/favorite/FavoriteButton';
import ClientOnlyBackButton from './ClientOnlyBackButton';
import DirectionsButton from '@/components/detail/DirectionsButton';
import { useCallback, useEffect, useMemo, useState } from 'react';
import io, { Socket } from 'socket.io-client';

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
  currentUserId: string; // 로그인 강제 상태라 null 없음
  toilet: Toilet;
}

/** 이 파일 안에서만 쓰는 활성 신호 타입 — 중복 import/선언 금지! */
type ActiveSignal = {
  _id: string;
  toiletId: string;
  lat: number;
  lng: number;
  message?: string;
  userId: string;                    // 요청자
  acceptedByUserId?: string | null;  // 구원자
  createdAt: string;
  expiresAt: string;
  status?: 'active' | 'accepted' | 'canceled' | 'completed';
};

export default function ToiletDetailPage({
  id,
  placeName = '',
  from = '',
  currentUserId,
  toilet,
}: ToiletDetailPageProps) {
  const rating = typeof toilet.overallRating === 'number' ? toilet.overallRating : 3;
  const encodedName = encodeURIComponent(placeName || toilet.place_name || '');

  const [activeSignals, setActiveSignals] = useState<ActiveSignal[]>([]);
  const [socket, setSocket] = useState<Socket | null>(null);

  // 남은 시간 포맷
  const timeLeft = (expiresAt: string) => {
    const ms = new Date(expiresAt).getTime() - Date.now();
    if (ms <= 0) return '만료';
    const s = Math.floor(ms / 1000);
    const m = Math.floor(s / 60);
    const rs = s % 60;
    return m > 0 ? `${m}분 ${rs}초 남음` : `${rs}초 남음`;
  };

  // 1초마다 리렌더(남은 시간 갱신)
  const tick = useMemo(() => ({ v: 0 }), []);
  useEffect(() => {
    const t = setInterval(() => {
      tick.v += 1;
      setActiveSignals(prev => [...prev]);
    }, 1000);
    return () => clearInterval(t);
  }, [tick]);

  // 활성 신호 조회 (의존성 안전)
  const fetchActive = useCallback(async () => {
    try {
      const resp = await fetch(`/api/signal/active?toiletIds=${encodeURIComponent(id)}`, { cache: 'no-store' });
      if (!resp.ok) return;
      const data = (await resp.json()) as { ok?: true; items?: ActiveSignal[] };
      setActiveSignals(data.items ?? []);
    } catch {
      // ignore
    }
  }, [id]);

  // 소켓 연결 & 이벤트 수신
  useEffect(() => {
    fetchActive();

    fetch('/api/socketio-init').finally(() => {
      const s = io({ path: '/api/socket', transports: ['websocket'] });
      s.on('connect', () => {
        s.emit('join_toilet', id);
      });

      const refetch = () => fetchActive();
      s.on('paper_request', refetch);
      s.on('paper_accepted', refetch);
      s.on('paper_accept_canceled', refetch);
      s.on('paper_request_canceled', refetch);

      setSocket(s);

      return () => {
        s.off('paper_request', refetch);
        s.off('paper_accepted', refetch);
        s.off('paper_accept_canceled', refetch);
        s.off('paper_request_canceled', refetch);
        s.emit('leave_toilet', id);
        s.disconnect();
      };
    });
  }, [id, fetchActive]);

  // “갈께요”
  async function accept(signalId: string) {
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
    await fetchActive();
  }

  // “갈께요 취소”
  async function cancelAccept(signalId: string) {
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
    await fetchActive();
  }

  // “요청 취소”(내 글)
  async function cancelRequest(signalId: string) {
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
    await fetchActive();
  }

  // 수락자 라벨
  function acceptedLabel(sig: ActiveSignal): string {
    if (!sig.acceptedByUserId) return '';
    if (sig.acceptedByUserId === currentUserId) return '내가 가는 중';
    const short = sig.acceptedByUserId.slice(-4);
    return `구원자: ****${short}`;
  }

  const isMine = (sig: ActiveSignal) => sig.userId === currentUserId;
  const isAcceptedByMe = (sig: ActiveSignal) => sig.acceptedByUserId === currentUserId;

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
          <a href={`/toilet/${id}/keywords?place_name=${encodedName}${from ? `&from=${from}` : ''}`}>키워드 추가하기</a>
          <a href={`/toilet/${id}/rate?place_name=${encodedName}${from ? `&from=${from}` : ''}`}>별점 추가하기</a>
          <DirectionsButton placeName={toilet.place_name} lat={toilet.lat} lng={toilet.lng} />
        </div>
      </div>

      {/* 활성 요청 리스트 */}
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

                <div className="active-meta">
                  {timeLeft(s.expiresAt)}

                  <div style={{ marginTop: 6, display: 'flex', gap: 8, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                    {/* 다른 사람 글 + 수락자 없음 → 갈께요 */}
                    {!s.acceptedByUserId && !isMine(s) && (
                      <button type="button" className="action-btn" onClick={() => accept(s._id)}>
                        갈께요
                      </button>
                    )}

                    {/* 내가 수락한 글 → 갈께요 취소 */}
                    {isAcceptedByMe(s) && (
                      <button type="button" className="action-btn" onClick={() => cancelAccept(s._id)}>
                        갈께요 취소
                      </button>
                    )}

                    {/* 내 글(만료 전) → 요청 취소 */}
                    {isMine(s) && new Date(s.expiresAt).getTime() > Date.now() && (
                      <button
                        type="button"
                        className="action-btn danger"
                        onClick={() => cancelRequest(s._id)}
                      >
                        요청 취소
                      </button>
                    )}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* 독립 요청 카드 */}
      <div className="request-card">
        <div className="request-title">휴지 요청 보내기</div>
        <div className="request-row">
          <PaperRequestForm toiletId={id} lat={toilet.lat} lng={toilet.lng} userId={currentUserId} />
        </div>
        <div className="request-hint">예: 남자 화장실 2번째 칸입니다. (최대 120자)</div>
      </div>

      <div className="tags-box">
        사용자들의 평균 점수
        <div>청결: {toilet.cleanliness}점</div>
        <div>시설: {toilet.facility}점</div>
        <div>편의: {toilet.convenience}점</div>
      </div>

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
