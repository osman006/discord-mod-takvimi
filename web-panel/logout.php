<?php
require_once 'config.php';

// Session'ı temizle
session_destroy();

// Login sayfasına yönlendir
redirect('login.php');
?> 