'use client';

import { useToilet } from '@/context/ToiletContext';
import './ToiletList.css'; // 아래 CSS 참고

export default function ToiletListPage() {
    const { toiletList, toggleFavorite } = useToilet();

    return (
        <div className="list-page">
            {toiletList.length === 0 ? (
                <p>화장실을 불러오는 중입니다...</p>
            ) : (
                <ul className="toilet-list">
                    {toiletList.map((toilet, index) => (
                        <li className="toilet-card" key={index}>
                            <div className="left-section">
                                <span className="favorite-icon" onClick={() => toggleFavorite(toilet)}>
                                    ★
                                </span>

                            </div>
                            <div className="middle-section">
                                <div className="toilet-name"><strong>{toilet.place_name}</strong></div>
                                <div className="toilet-rating">★★★★☆</div>
                            </div>
                            <div className="right-section">
                                <div className="toilet-user">aaa-</div>
                                <div className="toilet-comment">여기 화장실 그냥 그래요</div>
                            </div>
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
}
