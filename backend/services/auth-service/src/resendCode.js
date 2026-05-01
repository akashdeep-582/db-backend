const {
    CognitoIdentityProviderClient,
    ResendConfirmationCodeCommand,
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
      const { email } = JSON.parse(event.body)
  
      if (!email) {
        return response(400, { message: 'email is required' })
      }
  
      const command = new ResendConfirmationCodeCommand({
        ClientId: process.env.COGNITO_CLIENT_ID,
        Username: email.replace('@', '_').replace(/\./g, '_')
      })
  
      await client.send(command)
  
      return response(200, {
        message: 'Verification code resent. Please check your email.'
      })
  
    } catch (error) {
      console.error('Resend code error:', error)
      return response(500, { message: 'Internal server error' })
    }
  }