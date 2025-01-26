

# Hostel Pro - Server 🛠️🔒  

The backend for **Hostel Pro**, a powerful hostel management system built using the **MERN stack**. This server handles all operations, including meal management, user authentication, review handling, and payment processing with top-notch security and performance.

---

## 🌟 Features  

1. **User Authentication** 🔐:  
   - Secure login and registration with JWT-based authentication.  
   - Role-based access for admins and users.  

2. **Meal Management** 🍔:  
   - Add, edit, delete, and retrieve meal information via APIs.  

3. **Review System** ⭐:  
   - CRUD operations for meal reviews.  

4. **Membership Packages** 💳:  
   - Handle membership upgrades with Stripe payment integration.  

5. **Upcoming Meals** 🗓️:  
   - API for managing and displaying future meal plans.  

6. **Admin Dashboard Support** 🛠️:  
   - APIs for managing users, meals, reviews, and statistics.  

7. **Pagination & Filtering** 📄:  
   - Optimized API responses with pagination and query filters.  

8. **Environment Variables Security** 🛡️:  
   - Protected API keys and credentials for Firebase, MongoDB, and Stripe.  

---

## 🛠️ Technologies  

- **Backend Framework**: Node.js, Express.js  
- **Database**: MongoDB (with Mongoose)  
- **Authentication**: JSON Web Tokens (JWT) + bcrypt for password hashing  
- **Payment Integration**: Stripe API  
- **Logging**: morgan for request logging  
- **Environment Management**: dotenv for secure credentials  

---

## 🚀 API Endpoints  

### **Authentication**  
- `POST /api/auth/register`: User registration.  
- `POST /api/auth/login`: User login with JWT generation.  

### **User Management**  
- `GET /api/users`: Fetch all users (admin only).  
- `PATCH /api/users/:id/make-admin`: Promote a user to admin.  

### **Meal Management**  
- `POST /api/meals`: Add a new meal (admin only).  
- `GET /api/meals`: Get meals (with search & filter).  
- `PATCH /api/meals/:id`: Update a meal (admin only).  
- `DELETE /api/meals/:id`: Delete a meal (admin only).  

### **Review Management**  
- `POST /api/reviews`: Add a review (user only).  
- `GET /api/reviews/:mealId`: Get all reviews for a specific meal.  
- `PATCH /api/reviews/:id`: Update a review (owner only).  
- `DELETE /api/reviews/:id`: Delete a review (owner or admin).  

### **Upcoming Meals**  
- `POST /api/upcoming-meals`: Add upcoming meal (admin only).  
- `GET /api/upcoming-meals`: Fetch upcoming meals.  

### **Payment**  
- `POST /api/payments/checkout`: Stripe checkout session creation.  
- `GET /api/payments/history`: Retrieve payment history for users.  

---

## 📂 Project Structure  

```plaintext  
HostelPro-Server/  
├── config/          # Configuration files (DB, Stripe, etc.)  
├── controllers/     # API controllers  
├── middlewares/     # Authentication, validation, and error handlers  
├── models/          # MongoDB models (User, Meal, Review, etc.)  
├── routes/          # Express.js routes for different modules  
├── utils/           # Helper functions and utilities  
├── .env             # Environment variables  
├── server.js        # Main server entry point  
└── README.md        # Project documentation  
```  

---

## 📦 Installation  

### 1. Clone the Repository  
```bash  
git clone https://github.com/your-repo/hostel-pro-server.git  
cd hostel-pro-server  
```  

### 2. Install Dependencies  
```bash  
npm install  
```  

### 3. Setup Environment Variables  
Create a `.env` file in the root directory and include the following:  
```plaintext  
PORT=5000  
MONGO_URI=your_mongodb_connection_string  
JWT_SECRET=your_jwt_secret  
STRIPE_SECRET_KEY=your_stripe_secret_key  
CLIENT_URL=http://localhost:3000  
```  

### 4. Start the Server  
```bash  
npm run dev  
```  
The server will run at `http://localhost:5000`.  

---

## 🌐 Live API  

The live API is hosted at: [Hostel Pro API](#)  

---

## 🛡️ Secure Practices  

1. **Environment Variables**: All sensitive data (keys and secrets) are stored in `.env`.  
2. **Password Hashing**: User passwords are hashed using bcrypt for added security.  
3. **Token Expiry**: JWTs include expiration to ensure session security.  
4. **Validation**: Input fields are validated to prevent invalid or malicious data.  

---

## 🔄 Common Scripts  

- `npm run dev`: Start the development server with hot-reloading.  
- `npm start`: Start the server in production mode.  
- `npm test`: Run tests (if implemented).  

---

## 🤝 Contributing  

Contributions are welcome! Please follow these steps:  
1. Fork the repository.  
2. Create a feature branch: `git checkout -b feature-name`.  
3. Commit your changes: `git commit -m 'Add a new feature'`.  
4. Push to the branch: `git push origin feature-name`.  
5. Open a pull request.  

---

## 📧 Contact  

For support or inquiries, email us at: **support@hostelpro.com**  

Thank you for making Hostel Pro your choice for seamless hostel management! 😊  
