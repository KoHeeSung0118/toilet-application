import Link from 'next/link'

export default async function signup() {
  return (
    <div >
      <div className="signup">
        <form action="/api/post/new" method="POST">
          <input name="email" placeholder="이메일" />
          <input name="password" placeholder="비밀번호" />
          <button type="submit">가입하기</button>
        </form>
        <button style={{
          marginTop:'20px'
        }}>
          <Link href={'../login'} style={{
            textDecoration: 'none',
            color: 'black',
          }}>로그인</Link>
        </button>
      </div>
    </div>
  )
}