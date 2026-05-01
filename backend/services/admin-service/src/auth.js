const { CognitoJwtVerifier } = require('aws-jwt-verify')
const pool = require('./db')

const verifier = CognitoJwtVerifier.create({
  userPoolId: process.env.COGNITO_USER_POOL_ID,
  clientId:   process.env.COGNITO_CLIENT_ID,
  tokenUse:   'access'
})

const verifyAdmin = async (event) => {
  const authHeader = event.headers?.authorization || event.headers?.Authorization
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return { error: 'Missing or invalid authorization header' }
  }

  const token = authHeader.split(' ')[1]

  try {
    const payload = await verifier.verify(token)
    const userResult = await pool.query('SELECT id, role FROM users WHERE id = $1', [payload.sub])

    if (userResult.rows.length === 0) return { error: 'User not found' }
    if (userResult.rows[0].role !== 'admin') return { error: 'Admin access required' }

    return { payload, user: userResult.rows[0] }
  } catch {
    return { error: 'Invalid or expired token' }
  }
}

module.exports = { verifyAdmin }
