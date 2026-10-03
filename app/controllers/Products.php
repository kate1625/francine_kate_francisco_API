<?php

defined('PREVENT_DIRECT_ACCESS') OR exit('No direct script access allowed');

class Products extends Controller
{
    private $db;
    private $api;

    public function __construct()
    {
        parent::__construct();
        $this->db = $this->call->database();
        $this->api = $this->call->library('api');
    }

    public function index()
    {
        $this->api->require_jwt();
        $products = $this->db->raw(
            'SELECT id, product_name, description, price, quantity, created_at FROM products ORDER BY created_at DESC, id DESC'
        )->fetchAll(PDO::FETCH_ASSOC);

        $this->api->respond(['products' => $products]);
    }

    public function show($id)
    {
        $this->api->require_jwt();
        $product = $this->find_product($id);

        if (!$product) {
            $this->api->respond_error('Product not found.', 404);
        }

        $this->api->respond(['product' => $product]);
    }

    public function create()
    {
        $this->api->require_jwt();
        $product = $this->validated_product($this->request_body());

        $this->db->raw(
            'INSERT INTO products (product_name, description, price, quantity) VALUES (?, ?, ?, ?)',
            [$product['product_name'], $product['description'], $product['price'], $product['quantity']]
        );
        $created = $this->find_product($this->db->last_id());

        $this->api->respond(['message' => 'Product created.', 'product' => $created], 201);
    }

    public function update($id)
    {
        $this->api->require_jwt();
        $existing = $this->find_product($id);
        if (!$existing) {
            $this->api->respond_error('Product not found.', 404);
        }

        $data = $this->request_body();
        if ($_SERVER['REQUEST_METHOD'] === 'PATCH') {
            $data = array_merge($existing, $data);
        }
        $product = $this->validated_product($data);
        $this->db->raw(
            'UPDATE products SET product_name = ?, description = ?, price = ?, quantity = ? WHERE id = ?',
            [$product['product_name'], $product['description'], $product['price'], $product['quantity'], (int) $id]
        );

        $this->api->respond([
            'message' => 'Product updated.',
            'product' => $this->find_product($id),
        ]);
    }

    public function delete($id)
    {
        $this->api->require_jwt();
        if (!$this->find_product($id)) {
            $this->api->respond_error('Product not found.', 404);
        }

        $this->db->raw('DELETE FROM products WHERE id = ?', [(int) $id]);
        $this->api->respond(['message' => 'Product deleted.']);
    }

    private function request_body()
    {
        $data = json_decode(file_get_contents('php://input'), true);
        if (!is_array($data)) {
            $this->api->respond_error('Request body must be a valid JSON object.', 400);
        }

        return $data;
    }

    private function validated_product($data)
    {
        $name = $data['product_name'] ?? null;
        $description = $data['description'] ?? '';
        $price = $data['price'] ?? null;
        $quantity = $data['quantity'] ?? null;

        if ($description === null) {
            $description = '';
        }

        if (!is_string($name) || trim($name) === '' || strlen(trim($name)) > 100) {
            $this->api->respond_error('Product name is required and must be 100 characters or fewer.', 422);
        }
        if (!is_string($description) || strlen($description) > 65535) {
            $this->api->respond_error('Description must be text.', 422);
        }
        if (!is_numeric($price) || !preg_match('/\A\d+(?:\.\d{1,2})?\z/', (string) $price) || (float) $price >= 100000000) {
            $this->api->respond_error('Price must be a number from 0 to 99,999,999.99.', 422);
        }
        if (filter_var($quantity, FILTER_VALIDATE_INT) === false || (int) $quantity < 0) {
            $this->api->respond_error('Quantity must be a non-negative whole number.', 422);
        }

        return [
            'product_name' => trim($name),
            'description' => $description,
            'price' => number_format((float) $price, 2, '.', ''),
            'quantity' => (int) $quantity,
        ];
    }

    private function find_product($id)
    {
        if (!is_scalar($id) || !ctype_digit((string) $id) || (int) $id < 1) {
            $this->api->respond_error('Product ID must be a positive integer.', 422);
        }

        return $this->db->raw(
            'SELECT id, product_name, description, price, quantity, created_at FROM products WHERE id = ? LIMIT 1',
            [(int) $id]
        )->fetch(PDO::FETCH_ASSOC);
    }
}
