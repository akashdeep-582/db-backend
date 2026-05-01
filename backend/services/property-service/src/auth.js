const { CognitoJwtVerifier } = require('aws-jwt-verify')

const verifier = CognitoJwtVerifier.create({
  userPoolId: process.env.COGNITO_USER_POOL_ID,
  clientId:   process.env.COGNITO_CLIENT_ID,
  tokenUse:   'access'
})

const verifyToken = async (event) => {
  const authHeader = event.headers?.authorization || event.headers?.Authorization

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return { error: 'Missing or invalid authorization header' }
  }

  const token = authHeader.split(' ')[1]

  try {
    const payload = await verifier.verify(token)
    return { payload }
  } catch {
    return { error: 'Invalid or expired token' }
  }
}

module.exports = { verifyToken }
