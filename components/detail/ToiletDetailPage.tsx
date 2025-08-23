'use client';

import './DetailPage.css';
import PaperRequestForm from '@/components/detail/PaperRequestForm';
import DeleteCommentButton from './DeleteCommentButton';
import FavoriteButton from '@/components/favorite/FavoriteButton';
import ClientOnlyBackButton from './ClientOnlyBackButton';
import DirectionsButton from '@/components/detail/DirectionsButton';
import { useCallback, useEffect, useRef, useState } from 'react';
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
  acceptedByUserId?: string | null;// 구원자
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
  const socketRef = useRef<Socket | null>(null);

  // 1초마다 강제 리렌더(남은 시간 갱신)
  const [, forceTick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => forceTick((v) => v + 1), 1000);
    return () => clearInterval(t);
  }, []);

  // 남은 시간 텍스트
  const timeLeft = (expiresAt: string) => {
    const ms = new Date(expiresAt).getTime() - Date.now();
    if (ms <= 0) return '만료';
    const s = Math.floor(ms / 1000);
    const m = Math.floor(s / 60);
    const rs = s % 60;
    return m > 0 ? `${m}분 ${rs}초 남음` : `${rs}초 남음`;
  };

  // 내 글/내가 수락 여부
  const isMine = (sig: ActiveSignal) => sig.userId === currentUserId;
  const isAcceptedByMe = (sig: ActiveSignal) => sig.acceptedByUserId === currentUserId;

  // 수락/취소 라벨
  const acceptedLabel = (sig: ActiveSignal): string => {
    if (!sig.acceptedByUserId) return '';
    if (isAcceptedByMe(sig)) return '내가 가는 중';
    const short = sig.acceptedByUserId.slice(-4);
    return `구원자: ****${short}`;
  };

  // ✅ 서버 목록과 temp-* 카드를 "머지"해서 반영 (디자인 불변)
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

  // 서버 상태 가져오기 → 반드시 merge 사용
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

  // 🔹 옵티미스틱: 폼 제출 시작 시 임시 카드 즉시 추가 (DOM 변경 없음)
  const onCreateStart = useCallback((p: { message?: string }): { tempId: string } => {
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
  }, [id, toilet.lat, toilet.lng, currentUserId]);

  // 성공 시 temp → 실제 카드 교체
  const onCreateSuccess = useCallback((args: { tempId: string; id: string; expiresAt: string; message?: string }) => {
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
  }, [id, toilet.lat, toilet.lng, currentUserId]);

  // 실패 시 temp 제거
  const onCreateError = useCallback((tempId: string) => {
    setActiveSignals((prev) => prev.filter((s) => s._id !== tempId));
  }, []);

  // 소켓 연결 (디자인 불변)
  useEffect(() => {
    let cancelled = false;

    const boot = async () => {
      await fetch('/api/socketio-init').catch(() => {});
      if (cancelled) return;

      const s = io({ path: '/api/socket', transports: ['websocket'] });
      socketRef.current = s;

      s.on('connect', () => {
        s.emit('join_toilet', id);
        s.emit('join_user', currentUserId);
      });

      // 서버 push는 즉시 upsert (refetch 없이)
      s.on('paper_request', (payload: PaperEvent) => {
        setActiveSignals((prev) => {
          const filtered = prev.filter((x) => x._id !== payload._id);
          return [payload, ...filtered];
        });
      });

      // 나머지는 보수적으로 재조회(merge가 temp 유지)
      const refetch = () => fetchActive();
      s.on('paper_accepted', refetch);
      s.on('paper_accept_canceled', refetch);
      s.on('paper_canceled', refetch);
      s.on('signals_changed', refetch);

      s.onAny((event: string) => {
        const e = event.toLowerCase();
        if (e.includes('paper') || e.includes('signal') || e.includes('accept') || e.includes('cancel')) {
          refetch();
        }
      });
    };

    fetchActive();
    boot();

    return () => {
      cancelled = true;
      const s = socketRef.current;
      if (s) {
        s.emit('leave_toilet', id);
        s.emit('leave_user', currentUserId);
        s.removeAllListeners();
        s.disconnect();
      }
    };
  }, [id, currentUserId, fetchActive]);

  // 소켓 누락 대비: 활성 신호가 있으면 3초 폴링(merge 유지)
  useEffect(() => {
    if (activeSignals.length === 0) return;
    const t = setInterval(fetchActive, 3000);
    return () => clearInterval(t);
  }, [activeSignals.length, fetchActive]);

  // 수락/취소/요청취소 (옵티미스틱 + 실패 롤백)
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

  // 시간 경과 포맷
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

  // ⬇️ 아래부터는 “처음 디자인”의 마크업/클래스 그대로 유지
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

      {/* 활성 요청 박스 */}
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

                  {/* 요청자: 본인 글이면 요청 취소 버튼 */}
                  {isMine(s) && (
                    <button className="action-btn" onClick={() => cancelMyRequest(s._id)}>
                      요청 취소
                    </button>
                  )}

                  {/* 타인 글: 미수락/내가 수락 */}
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

      {/* 휴지 요청 독립 카드 */}
      <div className="request-card">
        <div className="request-title">휴지 요청 보내기</div>
        <div className="request-row">
          <PaperRequestForm
            toiletId={id}
            lat={toilet.lat}
            lng={toilet.lng}
            userId={currentUserId}
            onCreateStart={onCreateStart}     // ✅ 로직만 추가, 디자인 그대로
            onCreateSuccess={onCreateSuccess}
            onCreateError={onCreateError}
          />
        </div>
        <div className="request-hint">
          예: 남자 화장실 2번째 칸입니다. (최대 120자)
        </div>
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
