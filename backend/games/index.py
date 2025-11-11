'''
Business: Game logic API for Rocket, Tower Rush and Slots
Args: event - dict with httpMethod, body, queryStringParameters
      context - object with attributes: request_id, function_name
Returns: HTTP response dict with game results
'''
import json
import os
import random
import psycopg2
from typing import Dict, Any

def handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    method: str = event.get('httpMethod', 'GET')
    
    if method == 'OPTIONS':
        return {
            'statusCode': 200,
            'headers': {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'POST, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type, X-User-Id',
                'Access-Control-Max-Age': '86400'
            },
            'body': ''
        }
    
    if method != 'POST':
        return {
            'statusCode': 405,
            'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
            'isBase64Encoded': False,
            'body': json.dumps({'error': 'Method not allowed'})
        }
    
    database_url = os.environ.get('DATABASE_URL')
    if not database_url:
        return {
            'statusCode': 500,
            'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
            'isBase64Encoded': False,
            'body': json.dumps({'error': 'Database not configured'})
        }
    
    body_data = json.loads(event.get('body', '{}'))
    game_type = body_data.get('game')
    user_id = body_data.get('userId')
    bet_amount = float(body_data.get('bet', 0))
    
    if not user_id or bet_amount <= 0:
        return {
            'statusCode': 400,
            'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
            'isBase64Encoded': False,
            'body': json.dumps({'error': 'Invalid request'})
        }
    
    conn = psycopg2.connect(database_url)
    cur = conn.cursor()
    
    try:
        cur.execute("SELECT balance FROM users WHERE id = %s", (user_id,))
        result = cur.fetchone()
        if not result:
            return {
                'statusCode': 404,
                'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                'isBase64Encoded': False,
                'body': json.dumps({'error': 'User not found'})
            }
        
        balance = float(result[0])
        if balance < bet_amount:
            return {
                'statusCode': 400,
                'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                'isBase64Encoded': False,
                'body': json.dumps({'error': 'Недостаточно средств'})
            }
        
        if game_type == 'rocket':
            multipliers = [1.2, 1.5, 2.0, 2.5, 3.0, 5.0, 10.0, 0]
            weights = [20, 15, 15, 10, 10, 5, 2, 23]
            multiplier = random.choices(multipliers, weights=weights)[0]
            win_amount = bet_amount * multiplier
            
            result_data = {
                'game': 'rocket',
                'multiplier': multiplier,
                'win': win_amount,
                'bet': bet_amount
            }
        
        elif game_type == 'tower':
            action = body_data.get('action')
            level = body_data.get('level', 1)
            
            if action == 'start':
                return {
                    'statusCode': 200,
                    'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                    'isBase64Encoded': False,
                    'body': json.dumps({
                        'success': True,
                        'level': 1,
                        'multiplier': 1.0,
                        'bet': bet_amount
                    })
                }
            
            elif action == 'build':
                success_chance = max(0.3, 1.0 - (level * 0.08))
                success = random.random() < success_chance
                
                if success:
                    multiplier = 1.0 + (level * 0.3)
                    win_amount = bet_amount * multiplier
                    
                    result_data = {
                        'game': 'tower',
                        'success': True,
                        'level': level + 1,
                        'multiplier': multiplier,
                        'win': win_amount,
                        'bet': bet_amount
                    }
                else:
                    result_data = {
                        'game': 'tower',
                        'success': False,
                        'level': level,
                        'multiplier': 0,
                        'win': 0,
                        'bet': bet_amount
                    }
                    win_amount = 0
                    multiplier = 0
            
            elif action == 'cashout':
                multiplier = 1.0 + ((level - 1) * 0.3)
                win_amount = bet_amount * multiplier
                
                result_data = {
                    'game': 'tower',
                    'cashout': True,
                    'level': level,
                    'multiplier': multiplier,
                    'win': win_amount,
                    'bet': bet_amount
                }
            else:
                return {
                    'statusCode': 400,
                    'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                    'isBase64Encoded': False,
                    'body': json.dumps({'error': 'Invalid tower action'})
                }
        
        elif game_type == 'slots':
            symbols = ['🍒', '🍋', '🍊', '7️⃣', '💎', '⭐']
            weights = [30, 25, 20, 10, 10, 5]
            
            reels = [
                random.choices(symbols, weights=weights)[0],
                random.choices(symbols, weights=weights)[0],
                random.choices(symbols, weights=weights)[0]
            ]
            
            if reels[0] == reels[1] == reels[2]:
                if reels[0] == '💎':
                    multiplier = 50.0
                elif reels[0] == '7️⃣':
                    multiplier = 20.0
                elif reels[0] == '⭐':
                    multiplier = 15.0
                else:
                    multiplier = 5.0
            elif reels[0] == reels[1] or reels[1] == reels[2]:
                multiplier = 2.0
            else:
                multiplier = 0
            
            win_amount = bet_amount * multiplier
            
            result_data = {
                'game': 'slots',
                'reels': reels,
                'multiplier': multiplier,
                'win': win_amount,
                'bet': bet_amount
            }
        
        else:
            return {
                'statusCode': 400,
                'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                'isBase64Encoded': False,
                'body': json.dumps({'error': 'Unknown game type'})
            }
        
        if game_type != 'tower' or action in ['build', 'cashout']:
            new_balance = balance - bet_amount + win_amount
            
            cur.execute(
                "UPDATE users SET balance = %s WHERE id = %s",
                (new_balance, user_id)
            )
            
            cur.execute(
                "INSERT INTO transactions (user_id, game_name, bet_amount, win_amount, multiplier) VALUES (%s, %s, %s, %s, %s)",
                (user_id, game_type, bet_amount, win_amount, multiplier if 'multiplier' in result_data else 0)
            )
            
            conn.commit()
            
            result_data['balance'] = float(new_balance)
        
        return {
            'statusCode': 200,
            'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
            'isBase64Encoded': False,
            'body': json.dumps(result_data)
        }
    
    finally:
        cur.close()
        conn.close()
