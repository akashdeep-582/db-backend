const {
  CognitoIdentityProviderClient,
  SignUpCommand,
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
    const { email, password, full_name, phone, role } = JSON.parse(event.body)

    if (!email || !password || !full_name || !role) {
      return response(400, { message: 'email, password, full_name and role are required' })
    }

    if (!['owner', 'tenant'].includes(role)) {
      return response(400, { message: 'role must be owner or tenant' })
    }

    if (password.length < 8) {
      return response(400, { message: 'password must be at least 8 characters' })
    }

    const signUpCommand = new SignUpCommand({
      ClientId: process.env.COGNITO_CLIENT_ID,
      Username: email.replace('@', '_').replace(/\./g, '_'),
      Password: password,
      UserAttributes: [
        { Name: 'email', Value: email },
        { Name: 'name',  Value: full_name },
      ]
    })

    const cognitoResponse = await client.send(signUpCommand)
    const cognitoSub = cognitoResponse.UserSub

    const result = await pool.query(
      `INSERT INTO users (id, email, full_name, phone, role)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, email, full_name, role, created_at`,
      [cognitoSub, email, full_name, phone || null, role]
    )

    const newUser = result.rows[0]

    return response(201, {
      message: 'Registration successful. Please check your email to verify your account.',
      user: newUser
    })

  } catch (error) {
    if (error.name === 'UsernameExistsException') {
      return response(409, { message: 'An account with this email already exists' })
    }

    if (error.name === 'InvalidPasswordException') {
      return response(400, { message: 'Password does not meet requirements' })
    }

    console.error('Register error:', error)
    return response(500, { message: 'Internal server error' })
  }
}
