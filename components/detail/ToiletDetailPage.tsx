'use client';

import './DetailPage.css';
import RequestPaperButton from '@/components/detail/RequestPaperButton';
import DeleteCommentButton from './DeleteCommentButton';
import FavoriteButton from '@/components/favorite/FavoriteButton';
import ClientOnlyBackButton from './ClientOnlyBackButton';
import DirectionsButton from '@/components/detail/DirectionsButton';
import { useCallback, useEffect, useState } from 'react';

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
  currentUserId: string | null;
  toilet: Toilet;
}

interface ActiveSignal {
  _id: string;
  toiletId: string;
  lat: number;
  lng: number;
  message?: string;
  createdAt: string;
  expiresAt: string;
  isMine?: boolean; // 서버에서 내려줄 수 있음
}

/** 소켓 페이로드 타입 */
type PaperSignalEvent = {
  _id: string;
  toiletId: string;
  lat: number;
  lng: number;
  message?: string | null;
  createdAt: string;
  expiresAt: string;
};
type PaperCancelledEvent = { _id: string; toiletId: string; cancelledAt: string };

export default function ToiletDetailPage({
  id,
  placeName = '',
  from = '',
  currentUserId,
  toilet,
}: ToiletDetailPageProps) {
  const rating = typeof toilet.overallRating === 'number' ? toilet.overallRating : 3;
  const encodedName = encodeURIComponent(placeName || toilet.place_name || '');

  // 댓글 시간 표기
  const formatTimeAgo = (date: string | Date) => {
    const nowMs = Date.now();
    const then = new Date(date).getTime();
    const diffSec = Math.floor((nowMs - then) / 1000);
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

  // 활성 신호
  const [activeSignals, setActiveSignals] = useState<ActiveSignal[]>([]);

  // ★ 화면만 1초마다 다시 그림 (서버 호출 X)
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  // 서버에서 활성 신호 조회
  const fetchActive = useCallback(async () => {
    try {
      const resp = await fetch(
        `/api/signal/active?toiletIds=${encodeURIComponent(id)}`,
        { cache: 'no-store' }
      );
      if (!resp.ok) return;
      const data = (await resp.json()) as { ok?: true; items?: ActiveSignal[] };
      setActiveSignals(data.items ?? []);
    } catch {
      // ignore
    }
  }, [id]);

  // 최초/주기적 폴링(15초)
  useEffect(() => {
    fetchActive();
    const t = setInterval(fetchActive, 15000);
    return () => clearInterval(t);
  }, [fetchActive]);

  // 남은 시간 계산 (now 의존)
  const timeLeft = useCallback(
    (expiresAt: string) => {
      const ms = new Date(expiresAt).getTime() - now;
      if (ms <= 0) return '만료';
      const s = Math.floor(ms / 1000);
      if (s < 60) return `${s}초 남음`;
      const m = Math.floor(s / 60);
      const rs = s % 60;
      return `${m}분 ${rs}초 남음`;
    },
    [now]
  );

  // (선택) 만료된 항목은 화면에서 자동 제거
  useEffect(() => {
    setActiveSignals((prev) => prev.filter((s) => new Date(s.expiresAt).getTime() > now));
  }, [now]);

  // 소켓 구독 — 같은 화장실 방의 신호를 즉시 반영
  useEffect(() => {
    let cleanup = () => {};
    (async () => {
      try {
        // 소켓 서버 부착
        await fetch('/api/socketio-init', { cache: 'no-store' });

        const { io } = await import('socket.io-client');
        const socket = io({ path: '/api/socket', transports: ['websocket'] });

        socket.on('connect', () => {
          socket.emit('join_toilet', id);
        });

        socket.on('paper_request', (p: PaperSignalEvent) => {
          if (p.toiletId !== id) return;
          setActiveSignals((prev) => {
            const without = prev.filter((x) => x._id !== p._id);
            return [
              { ...p, message: p.message ?? undefined },
              ...without,
            ].sort(
              (a, b) =>
                new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
            );
          });
        });

        socket.on('paper_request_cancelled', (c: PaperCancelledEvent) => {
          if (c.toiletId !== id) return;
          setActiveSignals((prev) => prev.filter((x) => x._id !== c._id));
        });

        cleanup = () => {
          socket.emit('leave_toilet', id);
          socket.off('paper_request');
          socket.off('paper_request_cancelled');
          socket.disconnect();
        };
      } catch {
        // 소켓 실패 시에도 폴링으로 동작
      }
    })();
    return () => cleanup();
  }, [id]);

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

        {/* 액션 버튼 그룹 (휴지요청은 아래 독립 카드) */}
        <div className="btn-group">
          <a
            href={`/toilet/${id}/keywords?place_name=${encodedName}${
              from ? `&from=${from}` : ''
            }`}
          >
            키워드 추가하기
          </a>
          <a
            href={`/toilet/${id}/rate?place_name=${encodedName}${
              from ? `&from=${from}` : ''
            }`}
          >
            별점 추가하기
          </a>
          <DirectionsButton
            placeName={toilet.place_name}
            lat={toilet.lat}
            lng={toilet.lng}
          />
        </div>
      </div>

      {/* 활성 요청 박스 */}
      {activeSignals.length > 0 && (
        <div className="active-requests">
          <div className="active-title">요청 신호</div>
          <ul className="active-list">
            {activeSignals.map((s) => (
              <li key={s._id} className="active-item">
                <div className="active-msg">
                  {s.message && s.message.trim().length > 0 ? s.message : '메시지 없음'}
                </div>
                <div className="active-meta">{timeLeft(s.expiresAt)}</div>
                {s.isMine && (
                  <button
                    className="action-btn"
                    style={{ marginLeft: '0.5rem', whiteSpace: 'nowrap' }}
                    onClick={async () => {
                      if (!confirm('요청을 취소할까요?')) return;
                      const resp = await fetch('/api/signal/cancel', {
                        method: 'DELETE',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ id: s._id }),
                      });
                      const data = (await resp.json()) as { ok?: true; error?: string };
                      if (!resp.ok || !data.ok) {
                        alert(data.error ?? '취소 실패');
                      } else {
                        setActiveSignals((prev) => prev.filter((x) => x._id !== s._id));
                      }
                    }}
                  >
                    취소
                  </button>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* 휴지 요청: 독립 카드 (전송 성공 시 즉시 갱신) */}
      <div className="request-card">
        <div className="request-title">휴지 요청 보내기</div>
        <div className="request-row">
          <RequestPaperButton
            toiletId={id}
            lat={toilet.lat}
            lng={toilet.lng}
            onSent={fetchActive} // 전송 성공 즉시 목록 갱신
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
              (a, b) =>
                new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
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
        href={`/toilet/${id}/comment?place_name=${encodedName}${
          from ? `&from=${from}` : ''
        }`}
      >
        댓글 추가하기
      </a>
    </div>
  );
}
