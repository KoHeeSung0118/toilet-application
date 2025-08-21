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
  status?: 'active' | 'accepted' | 'canceled' | 'completed';
}
