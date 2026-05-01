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
  if (user.role !== 'tenant') return response(403, { message: 'Only tenants can request visits' })

  const { property_id, requested_date, requested_time, message } = JSON.parse(event.body)

  if (!property_id || !requested_date || !requested_time) {
    return response(400, { message: 'property_id, requested_date and requested_time are required' })
  }

  const propResult = await pool.query(
    'SELECT id, owner_id FROM properties WHERE id = $1 AND status = $2',
    [property_id, 'approved']
  )
  if (propResult.rows.length === 0) return response(404, { message: 'Property not found' })

  const property = propResult.rows[0]

  const result = await pool.query(
    `INSERT INTO visits (tenant_id, property_id, owner_id, requested_date, requested_time, message)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING *`,
    [user.id, property_id, property.owner_id, requested_date, requested_time, message || null]
  )

  return response(201, { message: 'Visit requested successfully', visit: result.rows[0] })
}
