const pool = require('./db')
const { verifyToken } = require('./auth')

const response = (statusCode, body) => ({
  statusCode,
  headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
  body: JSON.stringify(body)
})

exports.handler = async (event) => {
  const auth = await verifyToken(event)
  if (auth.error) return response(401, { message: auth.error })

  const ownerId = auth.payload.sub

  const result = await pool.query(
    `SELECT p.*,
            (SELECT s3_url FROM property_images WHERE property_id = p.id AND is_primary = true LIMIT 1) AS primary_image
     FROM properties p
     WHERE p.owner_id = $1
     ORDER BY p.created_at DESC`,
    [ownerId]
  )

  return response(200, {
    properties: result.rows,
    count: result.rows.length
  })
}
