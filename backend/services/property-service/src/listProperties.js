const pool = require('./db')

const response = (statusCode, body) => ({
  statusCode,
  headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
  body: JSON.stringify(body)
})

exports.handler = async (event) => {
  const q = event.queryStringParameters || {}

  const conditions = [`p.status = 'approved'`]
  const values = []
  let i = 1

  if (q.city)      { conditions.push(`p.city ILIKE $${i++}`);      values.push(`%${q.city}%`) }
  if (q.locality)  { conditions.push(`p.locality ILIKE $${i++}`);  values.push(`%${q.locality}%`) }
  if (q.type)      { conditions.push(`p.type = $${i++}`);          values.push(q.type) }
  if (q.furnished) { conditions.push(`p.furnished = $${i++}`);     values.push(q.furnished) }
  if (q.min_price) { conditions.push(`p.price >= $${i++}`);        values.push(parseInt(q.min_price)) }
  if (q.max_price) { conditions.push(`p.price <= $${i++}`);        values.push(parseInt(q.max_price)) }

  const where = conditions.join(' AND ')

  const result = await pool.query(
    `SELECT p.*,
            u.full_name AS owner_name,
            (SELECT s3_url FROM property_images WHERE property_id = p.id AND is_primary = true LIMIT 1) AS primary_image
     FROM properties p
     JOIN users u ON p.owner_id = u.id
     WHERE ${where}
     ORDER BY p.created_at DESC
     LIMIT $${i++} OFFSET $${i++}`,
    [...values, parseInt(q.limit) || 20, parseInt(q.offset) || 0]
  )

  return response(200, {
    properties: result.rows,
    count: result.rows.length
  })
}
