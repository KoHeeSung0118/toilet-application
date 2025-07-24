'use client';

import { useRouter } from 'next/navigation';
import './DeleteCommentButton.css'
import { DeleteIcon } from '../icons/DeleteIcon'

interface Props {
  toiletId: string;
  commentId: string;
}

export default function DeleteCommentButton({ toiletId, commentId }: Props) {
  const router = useRouter();

  const handleDelete = async () => {
    if (!confirm('정말 삭제하시겠습니까?')) return;

    const res = await fetch(`/api/toilet/${toiletId}/comment/delete`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ commentId }),
    });

    if (res.ok) {
      const result = await res.json();
      alert(result.message || '삭제 성공');
      router.refresh(); // ✅ 댓글 목록 새로고침
    } else {
      const err = await res.json();
      alert(err.message || '삭제 실패');
    }
  };

  return (
    <button
      className="delete-btn"
      onClick={handleDelete}
      aria-label="댓글 삭제"
    >
      <DeleteIcon width={30} height={30} />
     </button>
  );
}
