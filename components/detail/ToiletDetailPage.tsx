// components/detail/ToiletDetailPage.tsx
'use client';

import './DetailPage.css';
import PaperRequestForm from '@/components/detail/PaperRequestForm';
import DeleteCommentButton from './DeleteCommentButton';
import FavoriteButton from '@/components/favorite/FavoriteButton';
import ClientOnlyBackButton from './ClientOnlyBackButton';
import DirectionsButton from '@/components/detail/DirectionsButton';
import { useCallback, useEffect, useMemo, useState } from 'react';

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
  createdAt: string; // ISO
  expiresAt: string; // ISO
  requesterId: string;
  acceptedBy?: string | null;
}

/* 유틸 */
function formatTimeAgo(date: string | Date): string {
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
}

export default function ToiletDetailPage({
  id,
  placeName = '',
  from = '',
  currentUserId,
  toilet,
}: ToiletDetailPageProps) {
  const rating = typeof toilet.overallRating === 'number' ? toilet.overallRating : 3;
  const encodedName = useMemo(
    () => encodeURIComponent(placeName || toilet.place_name || ''),
    [placeName, toilet.place_name]
  );

  const [activeSignals, setActiveSignals] = useState<ActiveSignal[]>([]);
  const [nowTick, setNowTick] = useState<number>(Date.now());
  const [busy, setBusy] = useState<string | null>(null);

  const fetchActive = useCallback(async () => {
    let resp: Response;
    try {
      resp = await fetch(`/api/signal/active?toiletIds=${encodeURIComponent(id)}`, { cache: 'no-store' });
    } catch (e) {
      console.error('active fetch error', e);
      return;
    }
    if (!resp.ok) return;
    const data = (await resp.json()) as { ok?: true; items?: ActiveSignal[] };
    setActiveSignals(data.items ?? []);
  }, [id]);

  useEffect(() => {
    fetchActive();
  }, [fetchActive]);

  // 1초마다 타이머 UI 갱신
  useEffect(() => {
    const t = setInterval(() => setNowTick(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  // 20초마다 데이터 재조회
  useEffect(() => {
    const t = setInterval(fetchActive, 20000);
    return () => clearInterval(t);
  }, [fetchActive]);

  const timeLeft = useCallback(
    (expiresAt: string) => {
      const ms = new Date(expiresAt).getTime() - nowTick;
      if (ms <= 0) return '만료';
      const s = Math.floor(ms / 1000);
      if (s < 60) return `${s}초 남음`;
      const m = Math.floor(s / 60);
      const rs = s % 60;
      return `${m}분 ${rs}초 남음`;
    },
    [nowTick]
  );

  // 갈게요(수락)
  async function handleAccept(signalId: string) {
    if (!currentUserId) {
      alert('로그인이 필요합니다.');
      return;
    }
    setBusy(signalId);
    let res: Response;
    try {
      res = await fetch('/api/signal/accept', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ signalId }),
      });
    } catch (e) {
      console.error('accept network error', e);
      alert('네트워크 오류로 수락에 실패했어요.');
      setBusy(null);
      return;
    }

    if (res.ok) {
      setActiveSignals((prev) => prev.map((s) => (s._id === signalId ? { ...s, acceptedBy: currentUserId } : s)));
      setBusy(null);
      return;
    }
    if (res.status === 409) {
      alert('이미 다른 분이 수락했어요.');
      await fetchActive();
      setBusy(null);
      return;
    }
    if (res.status === 410) {
      alert('요청이 만료되었어요.');
      await fetchActive();
      setBusy(null);
      return;
    }

    const data = await res.json().catch(() => ({}));
    alert((data as { error?: string })?.error ?? '수락에 실패했어요.');
    setBusy(null);
  }

  // 갈게요 취소
  async function handleUnaccept(signalId: string) {
    if (!currentUserId) {
      alert('로그인이 필요합니다.');
      return;
    }
    setBusy(signalId);
    let res: Response;
    try {
      res = await fetch('/api/signal/unaccept', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ signalId }),
      });
    } catch (e) {
      console.error('unaccept network error', e);
      alert('네트워크 오류로 취소에 실패했어요.');
      setBusy(null);
      return;
    }

    if (res.ok) {
      setActiveSignals((prev) => prev.map((s) => (s._id === signalId ? { ...s, acceptedBy: null } : s)));
      setBusy(null);
      return;
    }

    const data = await res.json().catch(() => ({}));
    alert((data as { error?: string })?.error ?? '취소에 실패했어요.');
    await fetchActive();
    setBusy(null);
  }

  // 내 요청 취소(삭제)
  async function handleCancelMyRequest(signalId: string) {
    if (!currentUserId) {
      alert('로그인이 필요합니다.');
      return;
    }
    if (!confirm('요청을 취소할까요?')) return;

    setBusy(signalId);
    let res: Response;
    try {
      res = await fetch('/api/signal/cancel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ signalId }),
      });
    } catch (e) {
      console.error('cancel network error', e);
      alert('네트워크 오류로 취소에 실패했어요.');
      setBusy(null);
      return;
    }

    if (res.ok) {
      setActiveSignals((prev) => prev.filter((s) => s._id !== signalId));
      setBusy(null);
      return;
    }

    const data = await res.json().catch(() => ({}));
    alert((data as { error?: string })?.error ?? '취소에 실패했어요.');
    await fetchActive();
    setBusy(null);
  }

  // “갈게요”가 눌린 요청은 요청자/구원자만 보이도록 필터
  const filteredSignals = activeSignals.filter((s) => {
    if (!s.acceptedBy) return true; // 아직 오픈
    return s.requesterId === currentUserId || s.acceptedBy === currentUserId;
  });

  return (
    <div className="detail-page">
      <ClientOnlyBackButton />

      {/* 헤더 */}
      <div className="detail-header">
        <div className="favorite-wrapper">
          <FavoriteButton toiletId={id} placeName={toilet.place_name} />
        </div>
        <h2>{toilet.place_name}</h2>
        <div className="rating">{'★'.repeat(Math.round(rating)).padEnd(5, '☆')} ({rating.toFixed(1)})</div>

        {/* 액션 버튼 그룹 */}
        <div className="btn-group">
          <a href={`/toilet/${id}/keywords?place_name=${encodedName}${from ? `&from=${from}` : ''}`}>키워드 추가하기</a>
          <a href={`/toilet/${id}/rate?place_name=${encodedName}${from ? `&from=${from}` : ''}`}>별점 추가하기</a>
          <DirectionsButton placeName={toilet.place_name} lat={toilet.lat} lng={toilet.lng} />
        </div>
      </div>

      {/* 활성 요청 박스 */}
      {filteredSignals.length > 0 && (
        <div className="active-requests">
          <div className="active-title">요청 신호</div>
          <ul className="active-list">
            {filteredSignals.map((s) => {
              const isMine = currentUserId != null && s.requesterId === currentUserId;
              const iAmHelper = currentUserId != null && s.acceptedBy === currentUserId;
              const open = !s.acceptedBy;

              return (
                <li key={s._id} className="active-item">
                  <div className="active-msg">
                    {s.message && s.message.trim().length > 0 ? s.message : '메시지 없음'}
                  </div>
                  <div className="active-meta">{timeLeft(s.expiresAt)}</div>

                  <div style={{ display: 'flex', gap: '0.4rem' }}>
                    {isMine && (
                      <button
                        className="action-btn"
                        onClick={() => void handleCancelMyRequest(s._id)}
                        disabled={busy === s._id}
                        title="내 요청 취소"
                      >
                        요청 취소
                      </button>
                    )}
                    {!isMine && open && (
                      <button
                        className="action-btn"
                        onClick={() => void handleAccept(s._id)}
                        disabled={busy === s._id}
                        title="요청 수락"
                      >
                        갈게요
                      </button>
                    )}
                    {!isMine && iAmHelper && (
                      <button
                        className="action-btn"
                        onClick={() => void handleUnaccept(s._id)}
                        disabled={busy === s._id}
                        title="수락 취소"
                      >
                        취소
                      </button>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {/* ✅ 휴지 요청: 독립 카드 */}
      <div className="request-card">
        <div className="request-title">휴지 요청 보내기</div>
        <PaperRequestForm
          toiletId={id}
          lat={toilet.lat}
          lng={toilet.lng}
          userId={currentUserId}
          onSent={fetchActive}
        />
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

      {/* 댓글 작성 버튼 */}
      <a className="comment-btn" href={`/toilet/${id}/comment?place_name=${encodedName}${from ? `&from=${from}` : ''}`}>
        댓글 추가하기
      </a>
    </div>
  );
}
