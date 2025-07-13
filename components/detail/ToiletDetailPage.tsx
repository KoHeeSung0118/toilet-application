'use client';

import './DetailPage.css';
import DeleteCommentButton from './DeleteCommentButton';
import FavoriteButton from '@/components/favorite/FavoriteButton';
import ClientOnlyBackButton from './ClientOnlyBackButton';

interface Toilet {
    _id: string;
    place_name: string;
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

export default function ToiletDetailPage({
    id,
    placeName = '',
    from = '',
    currentUserId,
    toilet,
}: ToiletDetailPageProps) {
    const rating = typeof toilet.overallRating === 'number' ? toilet.overallRating : 3;
    const encodedName = encodeURIComponent(placeName || toilet.place_name || '');

    const getRatingStatus = (score?: number) =>
        score == null ? '정보 없음' : score >= 4 ? '좋음' : score >= 2.5 ? '보통' : '나쁨';

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
                    <a href={`/toilet/${id}/keywords?place_name=${encodedName}${from ? `&from=${from}` : ''}`}>
                        키워드 추가하기
                    </a>
                    <a href={`/toilet/${id}/rate?place_name=${encodedName}${from ? `&from=${from}` : ''}`}>
                        별점 추가하기
                    </a>
                </div>
            </div>

            <div className="tags-box">
                <div>청결: {getRatingStatus(toilet.cleanliness)}</div>
                <div>시설: {getRatingStatus(toilet.facility)}</div>
                <div>편의: {getRatingStatus(toilet.convenience)}</div>
            </div>

            {toilet.keywords?.length ? (
                <div className="keyword-box">
                    {toilet.keywords.map((kw, idx) => (
                        <span key={idx} className="tag">#{kw}</span>
                    ))}
                </div>
            ) : (
                <p style={{ marginTop: '1rem' }}>등록된 키워드가 없습니다.</p>
            )}

            <div className="reviews">
                <h3>댓글</h3>
                {toilet.reviews?.length ? (
                    toilet.reviews
                        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
                        .map((r) => (
                            <div key={r._id} className="comment-item">
                                <div className="comment-content">
                                    <span>
                                        <strong className="nickname">{r.nickname}</strong>: {r.comment}
                                    </span>
                                    {r.userId === currentUserId && (
                                        <DeleteCommentButton toiletId={id} commentId={r._id} />
                                    )}
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
