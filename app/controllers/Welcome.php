<?php
defined('PREVENT_DIRECT_ACCESS') OR exit('No direct script access allowed');

class Welcome extends Controller {
	public function index() {
		$frontend_index = ROOT_DIR . 'frontend' . DIRECTORY_SEPARATOR . 'dist' . DIRECTORY_SEPARATOR . 'index.html';

		if (is_file($frontend_index)) {
			header('Content-Type: text/html; charset=utf-8');
			readfile($frontend_index);
			return;
		}

		$this->call->view('welcome_page');
	}
}
?>