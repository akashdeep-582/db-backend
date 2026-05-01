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
  const status = q.status || 'pending'

  const result = await pool.query(
    `SELECT p.*, u.full_name AS owner_name, u.email AS owner_email
     FROM properties p
     JOIN users u ON p.owner_id = u.id
     WHERE p.status = $1
     ORDER BY p.created_at ASC`,
    [status]
  )

  return response(200, { properties: result.rows, count: result.rows.length })
}
