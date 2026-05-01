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

  // tenants see visits they requested, owners see visits for their properties
  const column = user.role === 'tenant' ? 'v.tenant_id' : 'v.owner_id'

  const result = await pool.query(
    `SELECT v.*, p.title AS property_title, p.city, p.locality,
            t.full_name AS tenant_name, t.phone AS tenant_phone
     FROM visits v
     JOIN properties p ON v.property_id = p.id
     JOIN users t ON v.tenant_id = t.id
     WHERE ${column} = $1
     ORDER BY v.created_at DESC`,
    [user.id]
  )

  return response(200, { visits: result.rows, count: result.rows.length })
}
