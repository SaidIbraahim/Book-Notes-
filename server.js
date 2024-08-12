import express from 'express';
import pkg from 'pg';
import axios from 'axios';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// Initialize environment variables
dotenv.config();

// Directory and file path utilities
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Initialize Express app
const app = express();
const port = process.env.PORT || 3000;

// Set up middleware
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.urlencoded({ extended: true }));

// Set view engine
app.set('view engine', 'ejs');

// PostgreSQL connection setup
const { Pool } = pkg;
const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  password: process.env.DB_PASSWORD,
  port: process.env.DB_PORT,
});

// Route to handle the root URL
app.get('/', (req, res) => {
    res.redirect('/books');
  });

// Route to get all books with sorting
app.get('/books', async (req, res) => {
  const { sort_by } = req.query;
  let sortQuery = 'ORDER BY read_date DESC';

  if (sort_by === 'rating') {
    sortQuery = 'ORDER BY rating DESC';
  } else if (sort_by === 'title') {
    sortQuery = 'ORDER BY title ASC';
  }

  try {
    const result = await pool.query(`SELECT * FROM books ${sortQuery}`);
    res.render('index', { books: result.rows });
  } catch (err) {
    console.error(err);
    res.status(500).send('Unable to fetch books at the moment. Please try again later.');
  }
});

// Route to add a new book
app.post('/books', async (req, res) => {
  const { title, author, rating, read_date } = req.body;
  try {
    // Fetch the book data from Open Library API
    const searchResponse = await axios.get(`https://openlibrary.org/search.json?title=${encodeURIComponent(title)}&author=${encodeURIComponent(author)}`);
    
    // Check if we got results
    if (searchResponse.data.numFound > 0) {
      const bookData = searchResponse.data.docs[0];  // Assuming the first result is the correct book
      const isbn = bookData.isbn ? bookData.isbn[0] : null;
      const cover_url = isbn ? `https://covers.openlibrary.org/b/isbn/${isbn}-M.jpg` : '/path/to/placeholder.jpg';

      // Save the book details to the database
      await pool.query(
        'INSERT INTO books (title, author, cover_url, rating, read_date) VALUES ($1, $2, $3, $4, $5)',
        [title, author, cover_url, parseFloat(rating), read_date]
      );
    } else {
      // Fallback if no book data found
      const cover_url = '/path/to/placeholder.jpg';
      await pool.query(
        'INSERT INTO books (title, author, cover_url, rating, read_date) VALUES ($1, $2, $3, $4, $5)',
        [title, author, cover_url, parseFloat(rating), read_date]
      );
    }

    res.redirect('/books');
  } catch (err) {
    console.error('Error adding book:', err);
    res.status(500).send('Unable to add the book. Please try again.');
  }
});


// Route to update a book
app.post('/books/:id', async (req, res) => {
  const { id } = req.params;
  const { title, author, rating, read_date } = req.body;
  try {
    const searchResponse = await axios.get(`https://openlibrary.org/search.json?title=${encodeURIComponent(title)}&author=${encodeURIComponent(author)}`);

    let cover_url = '/path/to/placeholder.jpg'; // Default placeholder
    if (searchResponse.data.numFound > 0) {
      const bookData = searchResponse.data.docs[0];
      const isbn = bookData.isbn ? bookData.isbn[0] : null;
      cover_url = isbn ? `https://covers.openlibrary.org/b/isbn/${isbn}-M.jpg` : cover_url;
    }

    await pool.query(
      'UPDATE books SET title = $1, author = $2, cover_url = $3, rating = $4, read_date = $5 WHERE id = $6',
      [title, author, cover_url, parseFloat(rating), read_date, id]
    );
    res.redirect('/books');
  } catch (err) {
    console.error('Error updating book:', err);
    res.status(500).send('Unable to update the book. Please try again.');
  }
});


// Route to delete a book
app.post('/books/delete/:id', async (req, res) => {
  const { id } = req.params;
  try {
    await pool.query('DELETE FROM books WHERE id = $1', [id]);
    res.redirect('/books');
  } catch (err) {
    console.error('Error deleting book:', err);
    res.status(500).send('Unable to delete the book. Please try again.');
  }
});

// Start the server
app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});
