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

  const { propertyId } = event.pathParameters

  const result = await pool.query(
    'DELETE FROM wishlists WHERE tenant_id = $1 AND property_id = $2 RETURNING id',
    [userResult.rows[0].id, propertyId]
  )

  if (result.rows.length === 0) return response(404, { message: 'Wishlist entry not found' })

  return response(200, { message: 'Property removed from wishlist' })
}
