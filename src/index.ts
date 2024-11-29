import express, { Request, Response, Application } from "express";
import fs from "fs";
import path from "path";
import multer, { FileFilterCallback } from "multer";

// Extend Request interface to include 'file' property
declare global {
  namespace Express {
    interface Request {
      file?: Express.Multer.File;
    }
  }
}

const app: Application = express();
const filePath = path.join(__dirname, "products.json");

// Middleware to parse JSON data from requests
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static files from the "public" directory
app.use(express.static("public"));

// Setup multer for file uploads
const upload = multer({
  dest: path.join(__dirname, "public/uploads/"),
  limits: { fileSize: 2 * 1024 * 1024 }, // 2MB limit
  fileFilter: (req: Request, file: Express.Multer.File, cb: FileFilterCallback) => {
    const validExtensions = ["image/jpeg", "image/png", "image/gif", "image/webp"];
    if (!validExtensions.includes(file.mimetype)) {
      return cb(new Error("Invalid file type"));
    }
    cb(null, true);
  },
});

// Product interface
interface Product {
  id: number;
  name: string;
  description: string;
  quantity: number;
  image?: string;
}

// Load products from file
function loadProducts(): Product[] {
  try {
    if (fs.existsSync(filePath)) {
      const data = fs.readFileSync(filePath, "utf-8");
      return JSON.parse(data) as Product[];
    }
    return [];
  } catch (error) {
    console.error("Error loading products:", error);
    return [];
  }
}

// Save products to file
function saveProducts(products: Product[]): void {
  try {
    fs.writeFileSync(filePath, JSON.stringify(products, null, 2), "utf-8");
  } catch (error) {
    console.error("Error saving products:", error);
  }
}

// Route to get all products
app.get("/products", (req: Request, res: Response) => {
  const products = loadProducts();
  res.json(products);
});

// Route to add a new product
app.post("/products", upload.single("image"), (req: Request, res: Response) => {
  const products = loadProducts();
  const { name, description, quantity } = req.body;

  // Validate inputs
  if (!name || !description || isNaN(Number(quantity)) || Number(quantity) < 0) {
    return res.status(400).send("Invalid product data");
  }

  // New product data
  const productData: Product = {
    id: Date.now(), // Create a new ID
    name,
    description,
    quantity: parseInt(quantity, 10),
  };

  // If an image is uploaded, save it
  if (req.file) {
    productData.image = `/uploads/${req.file.filename}`;
  }

  products.push(productData);
  saveProducts(products);

  res.status(201).send("Product added successfully");
});

// Route to update an existing product
app.put("/products", upload.single("image"), (req: Request, res: Response) => {
  const products = loadProducts();
  const { id, name, description, quantity } = req.body;

  // Validate inputs
  if (!id || !name || !description || isNaN(Number(quantity)) || Number(quantity) < 0) {
    return res.status(400).send("Invalid product data");
  }

  const productIndex = products.findIndex((p) => p.id === parseInt(id, 10));
  if (productIndex === -1) {
    return res.status(404).send("Product not found");
  }

  const updatedProduct: Product = {
    id: parseInt(id, 10),
    name,
    description,
    quantity: parseInt(quantity, 10),
  };

  // If an image is uploaded, save it
  if (req.file) {
    updatedProduct.image = `/uploads/${req.file.filename}`;
  } else {
    updatedProduct.image = products[productIndex].image;
  }

  products[productIndex] = updatedProduct;
  saveProducts(products);

  res.status(200).send("Product updated successfully");
});

// Route to get a single product by ID
app.get("/products/:id", (req: Request, res: Response) => {
  const products = loadProducts();
  const product = products.find((p) => p.id === parseInt(req.params.id, 10));
  if (!product) return res.status(404).send("Product not found");
  res.json(product);
});

// Route to delete a product by ID
app.delete("/products/:id", (req: Request, res: Response) => {
  let products = loadProducts();
  products = products.filter((p) => p.id !== parseInt(req.params.id, 10));
  saveProducts(products);
  res.status(200).send("Product deleted");
});

// Start the server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server is running at http://localhost:${PORT}`);
});
