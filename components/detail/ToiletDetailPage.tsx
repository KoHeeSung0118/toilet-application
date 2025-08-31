'use client';

import './DetailPage.css';
import PaperRequestForm from '@/components/detail/PaperRequestForm';
import DeleteCommentButton from './DeleteCommentButton';
import FavoriteButton from '@/components/favorite/FavoriteButton';
import ClientOnlyBackButton from './ClientOnlyBackButton';
import DirectionsButton from '@/components/detail/DirectionsButton';
import { useCallback, useEffect, useRef, useState } from 'react';
import { getPusher } from '@/lib/pusher-client';
import type { Channel } from 'pusher-js';

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
  currentUserId: string;
  toilet: Toilet;
}

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

type PaperEvent = ActiveSignal;

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
  const channelRef = useRef<Channel | null>(null);

  const [, forceTick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => forceTick((v) => v + 1), 1000);
    return () => clearInterval(t);
  }, []);

  const timeLeft = (expiresAt: string): string => {
    const ms = new Date(expiresAt).getTime() - Date.now();
    if (ms <= 0) return '만료';
    const s = Math.floor(ms / 1000);
    const m = Math.floor(s / 60);
    const rs = s % 60;
    return m > 0 ? `${m}분 ${rs}초 남음` : `${rs}초 남음`;
  };

  const isMine = (sig: ActiveSignal) => sig.userId === currentUserId;
  const isAcceptedByMe = (sig: ActiveSignal) => sig.acceptedByUserId === currentUserId;

  const acceptedLabel = (sig: ActiveSignal): string => {
    if (!sig.acceptedByUserId) return '';
    if (isAcceptedByMe(sig)) return '내가 가는 중';
    const short = sig.acceptedByUserId.slice(-4);
    return `구원자: ****${short}`;
  };

  const mergeAndSet = useCallback((incoming: ActiveSignal[]) => {
    setActiveSignals((prev) => {
      const temps = prev.filter((x) => x._id.startsWith('temp-'));
      const byId = new Map<string, ActiveSignal>();
      for (const it of incoming) byId.set(it._id, it);
      for (const t of temps) if (!byId.has(t._id)) byId.set(t._id, t);
      const arr = Array.from(byId.values());
      arr.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      return arr;
    });
  }, []);

  const fetchActive = useCallback(async () => {
    try {
      const resp = await fetch(`/api/signal/active?toiletIds=${encodeURIComponent(id)}`, { cache: 'no-store' });
      if (!resp.ok) return;
      const data = (await resp.json()) as { ok?: true; items?: ActiveSignal[] };
      mergeAndSet(data.items ?? []);
    } catch {
      /* ignore */
    }
  }, [id, mergeAndSet]);

  const onCreateStart = useCallback(
    (p: { message?: string }): { tempId: string } => {
      const tempId = `temp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const nowIso = new Date().toISOString();
      const expIso = new Date(Date.now() + 10 * 60 * 1000).toISOString();
      const tempCard: ActiveSignal = {
        _id: tempId,
        toiletId: id,
        lat: toilet.lat,
        lng: toilet.lng,
        message: p.message?.trim() || undefined,
        userId: currentUserId,
        acceptedByUserId: null,
        createdAt: nowIso,
        expiresAt: expIso,
      };
      setActiveSignals((prev) => [tempCard, ...prev]);
      return { tempId };
    },
    [id, toilet.lat, toilet.lng, currentUserId]
  );

  const onCreateSuccess = useCallback(
    (args: { tempId: string; id: string; expiresAt: string; message?: string }) => {
      setActiveSignals((prev) => {
        const next = prev.filter((s) => s._id !== args.tempId && s._id !== args.id);
        const real: ActiveSignal = {
          _id: args.id,
          toiletId: id,
          lat: toilet.lat,
          lng: toilet.lng,
          message: args.message?.trim() || undefined,
          userId: currentUserId,
          acceptedByUserId: null,
          createdAt: new Date().toISOString(),
          expiresAt: args.expiresAt,
        };
        return [real, ...next];
      });
    },
    [id, toilet.lat, toilet.lng, currentUserId]
  );

  const onCreateError = useCallback((tempId: string) => {
    setActiveSignals((prev) => prev.filter((s) => s._id !== tempId));
  }, []);

  // Pusher 구독
  useEffect(() => {
    let isUnmounted = false;

    const boot = async () => {
      await fetchActive();
      if (isUnmounted) return;

      const pusher = getPusher();
      const ch = pusher.subscribe(`toilet-${id}`);
      channelRef.current = ch;

      ch.bind('paper_request', (payload: PaperEvent) => {
        setActiveSignals((prev) => [payload, ...prev.filter((x) => x._id !== payload._id)]);
      });

      const refetch = () => fetchActive();
      ch.bind('paper_accepted', refetch);
      ch.bind('paper_accept_canceled', refetch);
      ch.bind('paper_canceled', refetch);
      ch.bind('paper_unaccepted', refetch);
      ch.bind('signals_changed', refetch);
    };

    void boot();

    return () => {
      isUnmounted = true;
      const ch = channelRef.current;
      if (ch) {
        ch.unbind_all();
        ch.pusher.unsubscribe(ch.name);
        channelRef.current = null;
      }
    };
  }, [id, fetchActive]);

  useEffect(() => {
    if (activeSignals.length === 0) return;
    const t = setInterval(fetchActive, 3000);
    return () => clearInterval(t);
  }, [activeSignals.length, fetchActive]);

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
                  {isMine(s) && (
                    <button className="action-btn" onClick={() => cancelMyRequest(s._id)}>
                      요청 취소
                    </button>
                  )}
                  {!isMine(s) && !s.acceptedByUserId && (
                    <button className="action-btn" onClick={() => accept(s._id)}>
                      갈께요
                    </button>
                  )}
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

      <div className="request-card">
        <div className="request-title">휴지 요청 보내기</div>
        <div className="request-row">
          <PaperRequestForm
            toiletId={id}
            lat={toilet.lat}
            lng={toilet.lng}
            userId={currentUserId}
            onCreateStart={onCreateStart}
            onCreateSuccess={onCreateSuccess}
            onCreateError={onCreateError}
          />
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
                    <span className="comment-date">{formatTimeAgo(r.createdAt)}</span>
                    {r.userId === currentUserId && <DeleteCommentButton toiletId={id} commentId={r._id} />}
                  </div>
                </div>
              </div>
            ))
        ) : (
          <p>아직 등록된 댓글이 없습니다.</p>
        )}
      </div>

      <a className="comment-btn" href={`/toilet/${id}/comment?place_name=${encodedName}${from ? `&from=${from}` : ''}`}>
        댓글 추가하기
      </a>
    </div>
  );
}
