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

  const userResult = await pool.query('SELECT id, role FROM users WHERE id = $1', [auth.payload.sub])
  if (userResult.rows.length === 0) return response(404, { message: 'User not found' })

  const user = userResult.rows[0]
  if (user.role !== 'tenant') return response(403, { message: 'Only tenants can save to wishlist' })

  const { property_id } = JSON.parse(event.body)
  if (!property_id) return response(400, { message: 'property_id is required' })

  const propCheck = await pool.query('SELECT id FROM properties WHERE id = $1 AND status = $2', [property_id, 'approved'])
  if (propCheck.rows.length === 0) return response(404, { message: 'Property not found' })

  try {
    const result = await pool.query(
      `INSERT INTO wishlists (tenant_id, property_id) VALUES ($1, $2) RETURNING *`,
      [user.id, property_id]
    )
    return response(201, { message: 'Property saved to wishlist', wishlist: result.rows[0] })
  } catch (error) {
    if (error.code === '23505') return response(409, { message: 'Property already in wishlist' })
    throw error
  }
}
