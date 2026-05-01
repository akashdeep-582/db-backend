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
  if (user.role !== 'owner') return response(403, { message: 'Only owners can approve or reject visits' })

  const { id } = event.pathParameters
  const { status, rejection_reason } = JSON.parse(event.body)

  if (!['approved', 'rejected'].includes(status)) {
    return response(400, { message: 'status must be approved or rejected' })
  }

  if (status === 'rejected' && !rejection_reason) {
    return response(400, { message: 'rejection_reason is required when rejecting' })
  }

  const visitCheck = await pool.query(
    'SELECT id FROM visits WHERE id = $1 AND owner_id = $2',
    [id, user.id]
  )
  if (visitCheck.rows.length === 0) return response(404, { message: 'Visit not found or access denied' })

  const result = await pool.query(
    `UPDATE visits SET status = $1, rejection_reason = $2, updated_at = NOW()
     WHERE id = $3 RETURNING *`,
    [status, rejection_reason || null, id]
  )

  return response(200, { message: `Visit ${status}`, visit: result.rows[0] })
}
