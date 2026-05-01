const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3')
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner')
const pool = require('./db')
const { verifyToken } = require('./auth')

const s3 = new S3Client({ region: process.env.AWS_REGION_NAME })

const response = (statusCode, body) => ({
  statusCode,
  headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
  body: JSON.stringify(body)
})

exports.handler = async (event) => {
  // 1. Verify JWT
  const auth = await verifyToken(event)
  if (auth.error) return response(401, { message: auth.error })

  const cognitoSub = auth.payload.sub
  const { id: propertyId } = event.pathParameters
  const { file_name, content_type, is_primary } = JSON.parse(event.body)

  if (!file_name || !content_type) {
    return response(400, { message: 'file_name and content_type are required' })
  }

  // 2. Confirm property belongs to this owner
  const propResult = await pool.query(
    'SELECT id FROM properties WHERE id = $1 AND owner_id = $2',
    [propertyId, cognitoSub]
  )

  if (propResult.rows.length === 0) {
    return response(403, { message: 'Property not found or access denied' })
  }

  // 3. Generate a pre-signed S3 URL (frontend uploads directly to S3)
  const s3Key = `properties/${propertyId}/${Date.now()}-${file_name}`

  const command = new PutObjectCommand({
    Bucket: process.env.S3_BUCKET_NAME,
    Key: s3Key,
    ContentType: content_type
  })

  const uploadUrl = await getSignedUrl(s3, command, { expiresIn: 300 })
  const s3Url = `https://${process.env.S3_BUCKET_NAME}.s3.ap-southeast-2.amazonaws.com/${s3Key}`

  // 4. Save image record in DB
  await pool.query(
    `INSERT INTO property_images (property_id, s3_url, is_primary) VALUES ($1, $2, $3)`,
    [propertyId, s3Url, is_primary || false]
  )

  return response(200, {
    message: 'Upload URL generated. PUT your image directly to this URL.',
    upload_url: uploadUrl,
    s3_url: s3Url
  })
}
