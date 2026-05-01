const pool = require('./db')

const response = (statusCode, body) => ({
  statusCode,
  headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
  body: JSON.stringify(body)
})

exports.handler = async (event) => {
  const { id } = event.pathParameters

  const result = await pool.query(
    `SELECT p.*,
            u.full_name AS owner_name, u.phone AS owner_phone,
            json_agg(json_build_object('id', pi.id, 'url', pi.s3_url, 'is_primary', pi.is_primary)) AS images
     FROM properties p
     JOIN users u ON p.owner_id = u.id
     LEFT JOIN property_images pi ON pi.property_id = p.id
     WHERE p.id = $1 AND p.status = 'approved'
     GROUP BY p.id, u.full_name, u.phone`,
    [id]
  )

  if (result.rows.length === 0) return response(404, { message: 'Property not found' })

  return response(200, { property: result.rows[0] })
}
