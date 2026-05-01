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
  const { status, rejection_reason } = JSON.parse(event.body)

  if (!['approved', 'rejected'].includes(status)) {
    return response(400, { message: 'status must be approved or rejected' })
  }

  if (status === 'rejected' && !rejection_reason) {
    return response(400, { message: 'rejection_reason is required when rejecting' })
  }

  const propCheck = await pool.query('SELECT id FROM properties WHERE id = $1', [id])
  if (propCheck.rows.length === 0) return response(404, { message: 'Property not found' })

  const result = await pool.query(
    `UPDATE properties SET status = $1, rejection_reason = $2, updated_at = NOW()
     WHERE id = $3 RETURNING *`,
    [status, rejection_reason || null, id]
  )

  return response(200, {
    message: `Property ${status}`,
    property: result.rows[0]
  })
}
