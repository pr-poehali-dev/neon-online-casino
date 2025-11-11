'''
Business: User registration and authentication API
Args: event - dict with httpMethod, body, queryStringParameters
      context - object with attributes: request_id, function_name
Returns: HTTP response dict with user data or error
'''
import json
import os
import hashlib
import psycopg2
from typing import Dict, Any

def handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    method: str = event.get('httpMethod', 'GET')
    
    if method == 'OPTIONS':
        return {
            'statusCode': 200,
            'headers': {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type, X-User-Id, X-Auth-Token',
                'Access-Control-Max-Age': '86400'
            },
            'body': ''
        }
    
    database_url = os.environ.get('DATABASE_URL')
    if not database_url:
        return {
            'statusCode': 500,
            'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
            'isBase64Encoded': False,
            'body': json.dumps({'error': 'Database not configured'})
        }
    
    conn = psycopg2.connect(database_url)
    cur = conn.cursor()
    
    try:
        if method == 'POST':
            body_data = json.loads(event.get('body', '{}'))
            action = body_data.get('action')
            
            if action == 'register':
                username = body_data.get('username', '').strip()
                email = body_data.get('email', '').strip().lower()
                password = body_data.get('password', '')
                
                if not username or not email or not password:
                    return {
                        'statusCode': 400,
                        'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                        'isBase64Encoded': False,
                        'body': json.dumps({'error': 'Заполните все поля'})
                    }
                
                password_hash = hashlib.sha256(password.encode()).hexdigest()
                
                cur.execute(
                    "SELECT id FROM users WHERE email = %s OR username = %s",
                    (email, username)
                )
                if cur.fetchone():
                    return {
                        'statusCode': 400,
                        'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                        'isBase64Encoded': False,
                        'body': json.dumps({'error': 'Пользователь уже существует'})
                    }
                
                cur.execute(
                    "INSERT INTO users (username, email, password_hash, balance, bonus_balance) VALUES (%s, %s, %s, 1000.00, 100.00) RETURNING id, username, email, balance, bonus_balance",
                    (username, email, password_hash)
                )
                user = cur.fetchone()
                conn.commit()
                
                cur.execute(
                    "INSERT INTO bonuses (user_id, bonus_type, amount, description) VALUES (%s, %s, %s, %s)",
                    (user[0], 'welcome', 100.00, 'Приветственный бонус')
                )
                conn.commit()
                
                return {
                    'statusCode': 200,
                    'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                    'isBase64Encoded': False,
                    'body': json.dumps({
                        'success': True,
                        'user': {
                            'id': user[0],
                            'username': user[1],
                            'email': user[2],
                            'balance': float(user[3]),
                            'bonus_balance': float(user[4])
                        }
                    })
                }
            
            elif action == 'login':
                email = body_data.get('email', '').strip().lower()
                password = body_data.get('password', '')
                
                if not email or not password:
                    return {
                        'statusCode': 400,
                        'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                        'isBase64Encoded': False,
                        'body': json.dumps({'error': 'Заполните все поля'})
                    }
                
                password_hash = hashlib.sha256(password.encode()).hexdigest()
                
                cur.execute(
                    "SELECT id, username, email, balance, bonus_balance FROM users WHERE email = %s AND password_hash = %s",
                    (email, password_hash)
                )
                user = cur.fetchone()
                
                if not user:
                    return {
                        'statusCode': 401,
                        'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                        'isBase64Encoded': False,
                        'body': json.dumps({'error': 'Неверный email или пароль'})
                    }
                
                return {
                    'statusCode': 200,
                    'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                    'isBase64Encoded': False,
                    'body': json.dumps({
                        'success': True,
                        'user': {
                            'id': user[0],
                            'username': user[1],
                            'email': user[2],
                            'balance': float(user[3]),
                            'bonus_balance': float(user[4])
                        }
                    })
                }
        
        elif method == 'GET':
            params = event.get('queryStringParameters', {})
            user_id = params.get('userId')
            
            if not user_id:
                return {
                    'statusCode': 400,
                    'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                    'isBase64Encoded': False,
                    'body': json.dumps({'error': 'User ID required'})
                }
            
            cur.execute(
                "SELECT id, username, email, balance, bonus_balance FROM users WHERE id = %s",
                (user_id,)
            )
            user = cur.fetchone()
            
            if not user:
                return {
                    'statusCode': 404,
                    'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                    'isBase64Encoded': False,
                    'body': json.dumps({'error': 'User not found'})
                }
            
            cur.execute(
                "SELECT id, bonus_type, amount, description, expires_at, created_at FROM bonuses WHERE user_id = %s ORDER BY created_at DESC",
                (user_id,)
            )
            bonuses = cur.fetchall()
            
            return {
                'statusCode': 200,
                'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                'isBase64Encoded': False,
                'body': json.dumps({
                    'user': {
                        'id': user[0],
                        'username': user[1],
                        'email': user[2],
                        'balance': float(user[3]),
                        'bonus_balance': float(user[4])
                    },
                    'bonuses': [{
                        'id': b[0],
                        'type': b[1],
                        'amount': float(b[2]),
                        'description': b[3],
                        'expires_at': b[4].isoformat() if b[4] else None,
                        'created_at': b[5].isoformat() if b[5] else None
                    } for b in bonuses]
                })
            }
        
        return {
            'statusCode': 405,
            'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
            'isBase64Encoded': False,
            'body': json.dumps({'error': 'Method not allowed'})
        }
    
    finally:
        cur.close()
        conn.close()
