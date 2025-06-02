'use client';

import { useToilet } from '@/context/ToiletContext';
import FavoriteButton from '@/components/favorite/FavoriteButton';
import './ToiletList.css';

export default function ToiletListPage() {
    const { toiletList } = useToilet();

    return (
        <div className="list-page">
            {toiletList.length === 0 ? (
                <p>화장실을 불러오는 중입니다...</p>
            ) : (
                <ul className="toilet-list">
                    {toiletList.map((toilet, index) => {
                        console.log('🚽 toilet 확인:', toilet); // 로그 남겨두면 좋아
                        return (
                            <li className="toilet-card" key={index}>
                                <div className="left-section">
                                    <FavoriteButton toiletId={toilet.id} />
                                </div>
                                <div className="middle-section">
                                    <div className="toilet-name">
                                        <strong>{toilet.place_name}</strong>
                                    </div>
                                    <div className="toilet-rating">★★★★☆</div>
                                </div>
                                <div className="right-section">
                                    <div className="toilet-user">aaa-</div>
                                    <div className="toilet-comment">여기 화장실 그냥 그래요</div>
                                </div>
                            </li>
                        );
                    })}
                </ul>
            )}
        </div>
    );
}
