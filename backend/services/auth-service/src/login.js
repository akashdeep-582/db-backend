const {
  CognitoIdentityProviderClient,
  InitiateAuthCommand,
} = require('@aws-sdk/client-cognito-identity-provider')

const pool = require('./db')

const client = new CognitoIdentityProviderClient({
  region: process.env.AWS_REGION_NAME
})

const response = (statusCode, body) => ({
  statusCode,
  headers: {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*'
  },
  body: JSON.stringify(body)
})

exports.handler = async (event) => {
  try {
    const { email, password } = JSON.parse(event.body)

    if (!email || !password) {
      return response(400, { message: 'email and password are required' })
    }

    const authCommand = new InitiateAuthCommand({
      AuthFlow: 'USER_PASSWORD_AUTH',
      ClientId: process.env.COGNITO_CLIENT_ID,
      AuthParameters: {
        USERNAME: email,
        PASSWORD: password
      }
    })

    const authResponse = await client.send(authCommand)
    const tokens = authResponse.AuthenticationResult

    const result = await pool.query(
      `SELECT id, email, full_name, phone, role, is_active
       FROM users WHERE email = $1`,
      [email]
    )

    if (result.rows.length === 0) {
      return response(404, { message: 'User not found' })
    }

    const user = result.rows[0]

    if (!user.is_active) {
      return response(403, { message: 'Your account has been deactivated' })
    }

    return response(200, {
      message: 'Login successful',
      tokens: {
        accessToken:  tokens.AccessToken,
        idToken:      tokens.IdToken,
        refreshToken: tokens.RefreshToken,
        expiresIn:    tokens.ExpiresIn
      },
      user: {
        id:        user.id,
        email:     user.email,
        full_name: user.full_name,
        role:      user.role
      }
    })

  } catch (error) {
    if (error.name === 'NotAuthorizedException') {
      return response(401, { message: 'Incorrect email or password' })
    }

    if (error.name === 'UserNotConfirmedException') {
      return response(403, { message: 'Please verify your email before logging in' })
    }

    if (error.name === 'UserNotFoundException') {
      return response(401, { message: 'Incorrect email or password' })
    }

    console.error('Login error:', error)
    return response(500, { message: 'Internal server error' })
  }
}
