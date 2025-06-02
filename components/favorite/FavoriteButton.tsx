'use client';

import { useEffect, useState } from 'react';

interface FavoriteButtonProps {
    toiletId: string; // string이어야 함
}

export default function FavoriteButton({ toiletId }: FavoriteButtonProps) {
    const [isFavorite, setIsFavorite] = useState(false);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!toiletId) return;

        const fetchFavoriteStatus = async () => {
            try {
                const res = await fetch(`/api/favorite/status?toiletId=${toiletId}`, {
                    credentials: 'include',
                });
                const data = await res.json();
                setIsFavorite(data.isFavorite);
            } catch (err) {
                console.error('즐겨찾기 상태 확인 실패:', err);
            } finally {
                setLoading(false);
            }
        };

        fetchFavoriteStatus();
    }, [toiletId]);

    const toggleFavorite = async () => {
        console.log('⭐ 클릭됨', toiletId);
        try {
            const res = await fetch('/api/favorite/toggle', {
                method: 'POST',
                credentials: 'include',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ toiletId }),
            });
            const data = await res.json();
            setIsFavorite(data.isFavorite);
        } catch (err) {
            console.error('즐겨찾기 토글 실패:', err);
        }
    };

    if (loading) return <span>☆</span>;

    return (
        <span
            onClick={toggleFavorite}
            className={`favorite-icon ${isFavorite ? 'active' : ''}`}
        >
            {isFavorite ? '★' : '☆'}
        </span>

    );
}
