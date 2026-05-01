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

  const { id } = event.pathParameters
  const { is_active } = JSON.parse(event.body)

  if (typeof is_active !== 'boolean') {
    return response(400, { message: 'is_active must be true or false' })
  }

  const userCheck = await pool.query('SELECT id FROM users WHERE id = $1', [id])
  if (userCheck.rows.length === 0) return response(404, { message: 'User not found' })

  const result = await pool.query(
    `UPDATE users SET is_active = $1, updated_at = NOW() WHERE id = $2 RETURNING id, email, full_name, role, is_active`,
    [is_active, id]
  )

  return response(200, {
    message: `User ${is_active ? 'activated' : 'deactivated'}`,
    user: result.rows[0]
  })
}
