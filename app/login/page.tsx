import Link from 'next/link'
export default async function signup() {
  return (
    <div className="signup">
      <form action="/api/post/login" method="POST">
        <input name="email" placeholder="이메일" />
        <input name="password" placeholder="비밀번호" />
        <button type="submit">로그인 버튼</button>
      </form>
      <button style={{
        marginTop: '20px'
      }}>
        <Link href={'../signup'} style={{
          textDecoration: 'none',
          color: 'black',
        }}>회원가입 버튼</Link>
      </button>
    </div>
  )
}