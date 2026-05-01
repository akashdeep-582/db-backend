const pool = require('./db')
const { verifyToken } = require('./auth')

const response = (statusCode, body) => ({
  statusCode,
  headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
  body: JSON.stringify(body)
})

exports.handler = async (event) => {
  // 1. Verify JWT - user must be logged in
  const auth = await verifyToken(event)
  if (auth.error) return response(401, { message: auth.error })

  // 2. Get owner ID from RDS using Cognito sub
  const cognitoSub = auth.payload.sub
  const userResult = await pool.query(
    'SELECT id, role FROM users WHERE id = $1',
    [cognitoSub]
  )

  if (userResult.rows.length === 0) return response(404, { message: 'User not found' })

  const user = userResult.rows[0]
  if (user.role !== 'owner') return response(403, { message: 'Only owners can post properties' })

  // 3. Parse and validate body
  const { title, description, city, locality, address, price, type, furnished, area_sqft, floor, total_floors, parking, available_from } = JSON.parse(event.body)

  if (!title || !city || !locality || !address || !price || !type || !furnished) {
    return response(400, { message: 'title, city, locality, address, price, type and furnished are required' })
  }

  const validTypes = ['1BHK', '2BHK', '3BHK', 'Studio', 'Villa']
  const validFurnished = ['furnished', 'semi', 'unfurnished']

  if (!validTypes.includes(type)) return response(400, { message: `type must be one of: ${validTypes.join(', ')}` })
  if (!validFurnished.includes(furnished)) return response(400, { message: `furnished must be one of: ${validFurnished.join(', ')}` })

  // 4. Insert into DB
  const result = await pool.query(
    `INSERT INTO properties
      (owner_id, title, description, city, locality, address, price, type, furnished, area_sqft, floor, total_floors, parking, available_from)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
     RETURNING *`,
    [user.id, title, description, city, locality, address, price, type, furnished, area_sqft || null, floor || null, total_floors || null, parking || false, available_from || null]
  )

  return response(201, {
    message: 'Property listed successfully. Pending admin approval.',
    property: result.rows[0]
  })
}
