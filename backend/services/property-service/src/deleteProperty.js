const { S3Client, DeleteObjectCommand } = require('@aws-sdk/client-s3')
const pool = require('./db')
const { verifyToken } = require('./auth')

const s3 = new S3Client({ region: process.env.AWS_REGION_NAME })

const response = (statusCode, body) => ({
  statusCode,
  headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
  body: JSON.stringify(body)
})

exports.handler = async (event) => {
  const auth = await verifyToken(event)
  if (auth.error) return response(401, { message: auth.error })

  const ownerId = auth.payload.sub
  const { id } = event.pathParameters

  // Confirm property belongs to this owner
  const propResult = await pool.query(
    'SELECT id FROM properties WHERE id = $1 AND owner_id = $2',
    [id, ownerId]
  )
  if (propResult.rows.length === 0) {
    return response(404, { message: 'Property not found or access denied' })
  }

  // Fetch image s3_urls to delete from S3
  const imagesResult = await pool.query(
    'SELECT s3_url FROM property_images WHERE property_id = $1',
    [id]
  )

  // Delete S3 objects
  const bucket = process.env.S3_BUCKET_NAME
  for (const row of imagesResult.rows) {
    const key = row.s3_url.split('.amazonaws.com/')[1]
    if (key) {
      await s3.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }))
    }
  }

  // Delete DB records (images cascade or delete manually first)
  await pool.query('DELETE FROM property_images WHERE property_id = $1', [id])
  await pool.query('DELETE FROM properties WHERE id = $1', [id])

  return response(200, { message: 'Property deleted successfully' })
}
