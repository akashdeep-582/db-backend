const {
  CognitoIdentityProviderClient,
  ConfirmSignUpCommand,
} = require('@aws-sdk/client-cognito-identity-provider')

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
    const { email, code } = JSON.parse(event.body)

    if (!email || !code) {
      return response(400, { message: 'email and code are required' })
    }

    const confirmCommand = new ConfirmSignUpCommand({
      ClientId: process.env.COGNITO_CLIENT_ID,
      Username: email,
      ConfirmationCode: code
    })

    await client.send(confirmCommand)

    return response(200, {
      message: 'Email verified successfully. You can now log in.'
    })

  } catch (error) {
    if (error.name === 'CodeMismatchException') {
      return response(400, { message: 'Invalid verification code' })
    }

    if (error.name === 'ExpiredCodeException') {
      return response(400, { message: 'Verification code has expired. Please request a new one.' })
    }

    console.error('Verify error:', error)
    return response(500, { message: 'Internal server error' })
  }
}
