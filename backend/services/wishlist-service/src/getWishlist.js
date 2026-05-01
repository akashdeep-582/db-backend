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

  const userResult = await pool.query('SELECT id FROM users WHERE id = $1', [auth.payload.sub])
  if (userResult.rows.length === 0) return response(404, { message: 'User not found' })

  const result = await pool.query(
    `SELECT w.id, w.created_at,
            p.id AS property_id, p.title, p.city, p.locality, p.price, p.type, p.furnished,
            (SELECT s3_url FROM property_images WHERE property_id = p.id AND is_primary = true LIMIT 1) AS primary_image
     FROM wishlists w
     JOIN properties p ON w.property_id = p.id
     WHERE w.tenant_id = $1
     ORDER BY w.created_at DESC`,
    [userResult.rows[0].id]
  )

  return response(200, { wishlists: result.rows, count: result.rows.length })
}
