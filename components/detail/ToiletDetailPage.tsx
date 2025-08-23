'use client';

import './DetailPage.css';
import PaperRequestForm from '@/components/detail/PaperRequestForm';
import DeleteCommentButton from './DeleteCommentButton';
import FavoriteButton from '@/components/favorite/FavoriteButton';
import ClientOnlyBackButton from './ClientOnlyBackButton';
import DirectionsButton from '@/components/detail/DirectionsButton';
import { useEffect, useRef, useState } from 'react';
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
  currentUserId: string;     // 로그인 강제 가정
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

  // 남은 시간 포맷
  const timeLeft = (expiresAt: string) => {
    const ms = new Date(expiresAt).getTime() - Date.now();
    if (ms <= 0) return '만료';
    const s = Math.floor(ms / 1000);
    const m = Math.floor(s / 60);
    const rs = s % 60;
    return m > 0 ? `${m}분 ${rs}초 남음` : `${rs}초 남음`;
  };

  // 1초 간격 리렌더(남은 시간 표시 갱신)
  const [, forceTick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => forceTick(v => v + 1), 1000);
    return () => clearInterval(t);
  }, []);

  // Active 가져오기
  const fetchActive = async () => {
    const resp = await fetch(`/api/signal/active?toiletIds=${encodeURIComponent(id)}`, { cache: 'no-store' });
    if (!resp.ok) return;
    const data = (await resp.json()) as { ok?: true; items?: ActiveSignal[] };
    setActiveSignals(data.items ?? []);
  };

  // 소켓 연결 + 이벤트 수신 → 즉시 재조회
  useEffect(() => {
    fetchActive();

    (async () => {
      await fetch('/api/socketio-init', { cache: 'no-store' }).catch(() => {});
      const s = io({ path: '/api/socket', transports: ['websocket'] });
      socketRef.current = s;

      const refetch = () => fetchActive();

      s.on('connect', () => {
        s.emit('join_toilet', id);
      });

      // 서버 표준 이벤트
      s.on('signals_changed', refetch);

      // 구버전 이벤트도 안전망으로 처리
      s.onAny((evt) => {
        const e = String(evt);
        if (e.startsWith('paper_') || e.startsWith('signal_')) refetch();
      });

      // 포커스 복귀 시 동기화
      const onFocus = () => fetchActive();
      window.addEventListener('focus', onFocus);

      return () => {
        window.removeEventListener('focus', onFocus);
        s.off('signals_changed', refetch);
        s.offAny();
        s.emit('leave_toilet', id);
        s.disconnect();
      };
    })();

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  // 액션들(낙관적 업데이트 + 서버 확인)
  async function accept(signalId: string) {
    // 낙관적
    setActiveSignals(prev =>
      prev.map(s => (s._id === signalId ? { ...s, acceptedByUserId: currentUserId } : s))
    );
    const r = await fetch('/api/signal/accept', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ signalId }),
    });
    if (!r.ok) {
      // 롤백
      setActiveSignals(prev =>
        prev.map(s => (s._id === signalId ? { ...s, acceptedByUserId: null } : s))
      );
      const e = (await r.json().catch(() => ({}))) as { error?: string };
      alert(e.error ?? '수락 실패');
      return;
    }
    fetchActive();
  }

  async function cancelAccept(signalId: string) {
    // 낙관적
    setActiveSignals(prev =>
      prev.map(s => (s._id === signalId ? { ...s, acceptedByUserId: null } : s))
    );
    const r = await fetch('/api/signal/accept-cancel', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ signalId }),
    });
    if (!r.ok) {
      // 롤백: 다시 내 것으로
      setActiveSignals(prev =>
        prev.map(s => (s._id === signalId ? { ...s, acceptedByUserId: currentUserId } : s))
      );
      const e = (await r.json().catch(() => ({}))) as { error?: string };
      alert(e.error ?? '취소 실패');
      return;
    }
    fetchActive();
  }

  async function cancelMine(signalId: string) {
    // 낙관적 제거
    const backup = activeSignals;
    setActiveSignals(prev => prev.filter(s => s._id !== signalId));

    const r = await fetch('/api/signal/cancel', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ signalId }),
    });
    if (!r.ok) {
      setActiveSignals(backup); // 롤백
      const e = (await r.json().catch(() => ({}))) as { error?: string };
      alert(e.error ?? '요청 취소 실패');
      return;
    }
    fetchActive();
  }

  const isMine = (sig: ActiveSignal) => sig.userId === currentUserId;
  const isAcceptedByMe = (sig: ActiveSignal) => sig.acceptedByUserId === currentUserId;
  const acceptedLabel = (sig: ActiveSignal) => {
    if (!sig.acceptedByUserId) return '';
    if (sig.acceptedByUserId === currentUserId) return '내가 가는 중';
    return `구원자: ****${sig.acceptedByUserId.slice(-4)}`;
    // 닉네임 시스템이 있으면 여기서 교체
  };

  return (
    <div className="detail-page">
      <ClientOnlyBackButton />

      <div className="detail-header">
        <div className="favorite-wrapper">
          <FavoriteButton toiletId={id} placeName={toilet.place_name} />
        </div>
        <h2>{toilet.place_name}</h2>
        <div className="rating">{'★'.repeat(Math.round(rating)).padEnd(5, '☆')} ({rating.toFixed(1)})</div>

        <div className="btn-group">
          <a href={`/toilet/${id}/keywords?place_name=${encodedName}${from ? `&from=${from}` : ''}`}>키워드 추가하기</a>
          <a href={`/toilet/${id}/rate?place_name=${encodedName}${from ? `&from=${from}` : ''}`}>별점 추가하기</a>
          <DirectionsButton placeName={toilet.place_name} lat={toilet.lat} lng={toilet.lng} />
        </div>
      </div>

      {/* 활성 요청 */}
      {activeSignals.length > 0 && (
        <div className="active-requests">
          <div className="active-title">요청 신호</div>
          <ul className="active-list">
            {activeSignals.map((s) => (
              <li key={s._id} className="active-item">
                <div className="active-msg">
                  {s.message ?? '메시지 없음'}
                  {!!s.acceptedByUserId && (
                    <div style={{ color: '#4E3CDB', fontWeight: 600, marginTop: 4 }}>
                      {acceptedLabel(s)}
                    </div>
                  )}
                </div>

                <div className="active-meta" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  {/* ⏱ 남은시간을 왼쪽에 */}
                  <span>{timeLeft(s.expiresAt)}</span>

                  {/* 액션 버튼들 */}
                  <div style={{ display: 'flex', gap: 8 }}>
                    {/* 내 글: 요청 취소 */}
                    {isMine(s) && (
                      <button className="action-btn" onClick={() => cancelMine(s._id)}>
                        요청 취소
                      </button>
                    )}

                    {/* 남 글: 아직 미수락이면 갈께요 */}
                    {!isMine(s) && !s.acceptedByUserId && (
                      <button className="action-btn" onClick={() => accept(s._id)}>
                        갈께요
                      </button>
                    )}

                    {/* 내가 수락한 글: 갈께요 취소 */}
                    {!isMine(s) && isAcceptedByMe(s) && (
                      <button className="action-btn" onClick={() => cancelAccept(s._id)}>
                        갈께요 취소
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
          <PaperRequestForm
            toiletId={id}
            lat={toilet.lat}
            lng={toilet.lng}
            userId={currentUserId}
            onCreated={fetchActive}   // ✅ 요청 직후 바로 목록 반영
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

      <a className="comment-btn" href={`/toilet/${id}/comment?place_name=${encodedName}${from ? `&from=${from}` : ''}`}>
        댓글 추가하기
      </a>
    </div>
  );
}
