<?php

defined('PREVENT_DIRECT_ACCESS') OR exit('No direct script access allowed');

class Auth extends Controller
{
    private $db;
    private $api;

    public function __construct()
    {
        parent::__construct();
        $this->db = $this->call->database();
        $this->api = $this->call->library('api');
    }

    public function register()
    {
        $this->api->rate_limit('auth_register', 5, 3600);
        $data = $this->request_body();
        $username = $data['username'] ?? '';
        $email = $data['email'] ?? '';
        $password = $data['password'] ?? '';

        if (!is_string($username) || !preg_match('/\A[a-zA-Z0-9_]{3,100}\z/', $username)) {
            $this->api->respond_error('Username must be 3-100 letters, numbers, or underscores.', 422);
        }
        if (!is_string($email) || !filter_var($email, FILTER_VALIDATE_EMAIL) || strlen($email) > 255) {
            $this->api->respond_error('A valid email address is required.', 422);
        }
        if (!is_string($password) || strlen($password) < 8) {
            $this->api->respond_error('Password must be at least 8 characters.', 422);
        }

        $existing = $this->db->raw(
            'SELECT id FROM users WHERE email = ? OR username = ? LIMIT 1',
            [$email, $username]
        )->fetch(PDO::FETCH_ASSOC);
        if ($existing) {
            $this->api->respond_error('Email or username is already registered.', 409);
        }

        $this->db->raw(
            'INSERT INTO users (username, email, password, role, is_active) VALUES (?, ?, ?, ?, ?)',
            [$username, $email, password_hash($password, PASSWORD_DEFAULT), 'user', 1]
        );
        $user = $this->find_user_by_email($email);

        $this->api->respond([
            'message' => 'Account created successfully.',
            'user' => $this->public_user($user),
            'tokens' => $this->api->issue_tokens([
                'id' => $user['id'],
                'role' => $user['role'],
            ]),
        ], 201);
    }

    public function login()
    {
        $this->api->rate_limit('auth_login', 10, 60);
        $data = $this->request_body();
        $identifier = $data['email'] ?? '';
        $password = $data['password'] ?? '';

        if (!is_string($identifier) || !is_string($password) || $identifier === '' || $password === '') {
            $this->api->respond_error('Email and password are required.', 422);
        }

        $user = $this->db->raw(
            'SELECT id, username, email, password, role, is_active FROM users WHERE email = ? OR username = ? LIMIT 1',
            [$identifier, $identifier]
        )->fetch(PDO::FETCH_ASSOC);

        if (!$user || !(int) $user['is_active'] || !password_verify($password, $user['password'])) {
            $this->api->respond_error('Invalid email/username or password.', 401);
        }

        $this->api->respond([
            'message' => 'Login successful.',
            'user' => $this->public_user($user),
            'tokens' => $this->api->issue_tokens([
                'id' => $user['id'],
                'role' => $user['role'],
            ]),
        ]);
    }

    public function refresh()
    {
        $data = $this->request_body();
        if (!is_string($data['refresh_token'] ?? null) || $data['refresh_token'] === '') {
            $this->api->respond_error('Refresh token is required.', 422);
        }

        $this->api->refresh_access_token($data['refresh_token']);
    }

    public function logout()
    {
        $this->api->require_jwt();
        $data = $this->request_body();
        if (is_string($data['refresh_token'] ?? null) && $data['refresh_token'] !== '') {
            $this->api->revoke_refresh_token($data['refresh_token']);
        }

        $this->api->respond(['message' => 'Logged out successfully.']);
    }

    public function me()
    {
        $payload = $this->api->require_jwt();
        $user = $this->db->raw(
            'SELECT id, username, email, role FROM users WHERE id = ? LIMIT 1',
            [$payload['sub']]
        )->fetch(PDO::FETCH_ASSOC);

        if (!$user) {
            $this->api->respond_error('User not found.', 404);
        }

        $this->api->respond(['user' => $this->public_user($user)]);
    }

    private function request_body()
    {
        $raw = file_get_contents('php://input');
        $data = json_decode($raw, true);

        if (!is_array($data)) {
            $this->api->respond_error('Request body must be a valid JSON object.', 400);
        }

        return $data;
    }

    private function find_user_by_email($email)
    {
        return $this->db->raw(
            'SELECT id, username, email, role FROM users WHERE email = ? LIMIT 1',
            [$email]
        )->fetch(PDO::FETCH_ASSOC);
    }

    private function public_user($user)
    {
        return [
            'id' => (int) $user['id'],
            'username' => $user['username'],
            'email' => $user['email'],
            'role' => $user['role'],
        ];
    }
}
