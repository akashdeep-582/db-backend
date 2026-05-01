const pool = require('./db')
const { verifyAdmin } = require('./auth')

const response = (statusCode, body) => ({
  statusCode,
  headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
  body: JSON.stringify(body)
})

exports.handler = async (event) => {
  const auth = await verifyAdmin(event)
  if (auth.error) return response(401, { message: auth.error })

  const q = event.queryStringParameters || {}
  const conditions = []
  const values = []
  let i = 1

  if (q.role)   { conditions.push(`role = $${i++}`);              values.push(q.role) }
  if (q.active) { conditions.push(`is_active = $${i++}`);         values.push(q.active === 'true') }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''

  const result = await pool.query(
    `SELECT id, email, full_name, phone, role, is_active, created_at FROM users ${where} ORDER BY created_at DESC`,
    values
  )

  return response(200, { users: result.rows, count: result.rows.length })
}
