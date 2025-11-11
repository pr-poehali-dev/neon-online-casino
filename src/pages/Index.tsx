import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import Icon from '@/components/ui/icon';
import { useToast } from '@/hooks/use-toast';

const API_AUTH = 'https://functions.poehali.dev/72bda008-54cc-447e-b6ec-816b5af3094f';
const API_GAMES = 'https://functions.poehali.dev/07c43f1d-7e4c-40f4-b32c-2a9b45b92071';

interface User {
  id: number;
  username: string;
  email: string;
  balance: number;
  bonus_balance: number;
}

interface Bonus {
  id: number;
  type: string;
  amount: number;
  description: string;
}

export default function Index() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLogin, setIsLogin] = useState(true);
  const [user, setUser] = useState<User | null>(null);
  const [bonuses, setBonuses] = useState<Bonus[]>([]);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');

  const [currentGame, setCurrentGame] = useState<string | null>(null);
  const [betAmount, setBetAmount] = useState(10);
  const [gameInProgress, setGameInProgress] = useState(false);

  const [rocketMultiplier, setRocketMultiplier] = useState(1.0);
  const [rocketActive, setRocketActive] = useState(false);

  const [towerLevel, setTowerLevel] = useState(1);
  const [towerBlocks, setTowerBlocks] = useState<number[]>([]);
  const [towerMultiplier, setTowerMultiplier] = useState(1.0);

  const [slotReels, setSlotReels] = useState(['🍒', '🍋', '🍊']);
  const [slotSpinning, setSlotSpinning] = useState(false);

  useEffect(() => {
    const savedUser = localStorage.getItem('casino_user');
    if (savedUser) {
      const userData = JSON.parse(savedUser);
      setUser(userData);
      setIsAuthenticated(true);
      fetchUserData(userData.id);
    }
  }, []);

  const fetchUserData = async (userId: number) => {
    try {
      const response = await fetch(`${API_AUTH}?userId=${userId}`);
      const data = await response.json();
      if (data.user) {
        setUser(data.user);
        setBonuses(data.bonuses || []);
        localStorage.setItem('casino_user', JSON.stringify(data.user));
      }
    } catch (error) {
      console.error('Failed to fetch user data:', error);
    }
  };

  const handleAuth = async () => {
    if (!email || !password || (!isLogin && !username)) {
      toast({
        title: 'Ошибка',
        description: 'Заполните все поля',
        variant: 'destructive',
      });
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(API_AUTH, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: isLogin ? 'login' : 'register',
          email,
          password,
          username: isLogin ? undefined : username,
        }),
      });

      const data = await response.json();

      if (data.error) {
        toast({
          title: 'Ошибка',
          description: data.error,
          variant: 'destructive',
        });
      } else if (data.success && data.user) {
        setUser(data.user);
        setIsAuthenticated(true);
        localStorage.setItem('casino_user', JSON.stringify(data.user));
        toast({
          title: 'Успешно!',
          description: isLogin ? 'Вы вошли в систему' : 'Регистрация завершена',
        });
        fetchUserData(data.user.id);
      }
    } catch (error) {
      toast({
        title: 'Ошибка',
        description: 'Не удалось подключиться к серверу',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const playRocket = async () => {
    if (!user || betAmount <= 0 || betAmount > user.balance) {
      toast({
        title: 'Ошибка',
        description: 'Проверьте сумму ставки',
        variant: 'destructive',
      });
      return;
    }

    setRocketActive(true);
    setGameInProgress(true);

    let currentMult = 1.0;
    const interval = setInterval(() => {
      currentMult += 0.1;
      setRocketMultiplier(parseFloat(currentMult.toFixed(1)));
    }, 100);

    setTimeout(async () => {
      clearInterval(interval);

      try {
        const response = await fetch(API_GAMES, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            game: 'rocket',
            userId: user.id,
            bet: betAmount,
          }),
        });

        const data = await response.json();
        setRocketMultiplier(data.multiplier);

        if (data.balance !== undefined) {
          setUser({ ...user, balance: data.balance });
          localStorage.setItem('casino_user', JSON.stringify({ ...user, balance: data.balance }));
        }

        if (data.win > 0) {
          toast({
            title: '🚀 Победа!',
            description: `Множитель: x${data.multiplier} | Выигрыш: ${data.win.toFixed(2)}₽`,
          });
        } else {
          toast({
            title: '💥 Взрыв!',
            description: 'Попробуйте еще раз!',
            variant: 'destructive',
          });
        }

        setRocketActive(false);
        setGameInProgress(false);
        setTimeout(() => setRocketMultiplier(1.0), 2000);
      } catch (error) {
        toast({
          title: 'Ошибка',
          description: 'Ошибка игры',
          variant: 'destructive',
        });
        setRocketActive(false);
        setGameInProgress(false);
      }
    }, Math.random() * 3000 + 2000);
  };

  const startTower = () => {
    if (!user || betAmount <= 0 || betAmount > user.balance) {
      toast({
        title: 'Ошибка',
        description: 'Проверьте сумму ставки',
        variant: 'destructive',
      });
      return;
    }

    setTowerLevel(1);
    setTowerBlocks([]);
    setTowerMultiplier(1.0);
    setGameInProgress(true);
  };

  const buildTowerBlock = async () => {
    if (!user) return;

    try {
      const response = await fetch(API_GAMES, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          game: 'tower',
          action: 'build',
          userId: user.id,
          bet: betAmount,
          level: towerLevel,
        }),
      });

      const data = await response.json();

      if (data.success) {
        setTowerLevel(data.level);
        setTowerMultiplier(data.multiplier);
        setTowerBlocks([...towerBlocks, towerLevel]);
        toast({
          title: '✅ Блок построен!',
          description: `Уровень ${data.level} | Множитель: x${data.multiplier.toFixed(2)}`,
        });
      } else {
        toast({
          title: '💥 Башня упала!',
          description: `Проигрыш: ${betAmount}₽`,
          variant: 'destructive',
        });
        if (data.balance !== undefined) {
          setUser({ ...user, balance: data.balance });
          localStorage.setItem('casino_user', JSON.stringify({ ...user, balance: data.balance }));
        }
        setGameInProgress(false);
        setTimeout(() => {
          setTowerBlocks([]);
          setTowerLevel(1);
          setTowerMultiplier(1.0);
        }, 2000);
      }
    } catch (error) {
      toast({
        title: 'Ошибка',
        description: 'Ошибка игры',
        variant: 'destructive',
      });
    }
  };

  const cashoutTower = async () => {
    if (!user) return;

    try {
      const response = await fetch(API_GAMES, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          game: 'tower',
          action: 'cashout',
          userId: user.id,
          bet: betAmount,
          level: towerLevel,
        }),
      });

      const data = await response.json();

      if (data.balance !== undefined) {
        setUser({ ...user, balance: data.balance });
        localStorage.setItem('casino_user', JSON.stringify({ ...user, balance: data.balance }));
      }

      toast({
        title: '💰 Выплата!',
        description: `Выигрыш: ${data.win.toFixed(2)}₽ | x${data.multiplier.toFixed(2)}`,
      });

      setGameInProgress(false);
      setTowerBlocks([]);
      setTowerLevel(1);
      setTowerMultiplier(1.0);
    } catch (error) {
      toast({
        title: 'Ошибка',
        description: 'Ошибка выплаты',
        variant: 'destructive',
      });
    }
  };

  const spinSlots = async () => {
    if (!user || betAmount <= 0 || betAmount > user.balance) {
      toast({
        title: 'Ошибка',
        description: 'Проверьте сумму ставки',
        variant: 'destructive',
      });
      return;
    }

    setSlotSpinning(true);
    setGameInProgress(true);

    const symbols = ['🍒', '🍋', '🍊', '7️⃣', '💎', '⭐'];
    const spinDuration = 2000;
    const spinInterval = 100;
    const iterations = spinDuration / spinInterval;

    let currentIteration = 0;
    const interval = setInterval(() => {
      setSlotReels([
        symbols[Math.floor(Math.random() * symbols.length)],
        symbols[Math.floor(Math.random() * symbols.length)],
        symbols[Math.floor(Math.random() * symbols.length)],
      ]);
      currentIteration++;

      if (currentIteration >= iterations) {
        clearInterval(interval);
      }
    }, spinInterval);

    try {
      const response = await fetch(API_GAMES, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          game: 'slots',
          userId: user.id,
          bet: betAmount,
        }),
      });

      const data = await response.json();

      setTimeout(() => {
        setSlotReels(data.reels);
        setSlotSpinning(false);
        setGameInProgress(false);

        if (data.balance !== undefined) {
          setUser({ ...user, balance: data.balance });
          localStorage.setItem('casino_user', JSON.stringify({ ...user, balance: data.balance }));
        }

        if (data.win > 0) {
          toast({
            title: '🎰 Победа!',
            description: `Множитель: x${data.multiplier} | Выигрыш: ${data.win.toFixed(2)}₽`,
          });
        } else {
          toast({
            title: 'Не повезло',
            description: 'Попробуйте еще раз!',
            variant: 'destructive',
          });
        }
      }, spinDuration);
    } catch (error) {
      setSlotSpinning(false);
      setGameInProgress(false);
      toast({
        title: 'Ошибка',
        description: 'Ошибка игры',
        variant: 'destructive',
      });
    }
  };

  const logout = () => {
    setIsAuthenticated(false);
    setUser(null);
    setBonuses([]);
    localStorage.removeItem('casino_user');
    setCurrentGame(null);
  };

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center p-4">
        <Card className="w-full max-w-md glass-card border-neon-purple/30 p-8">
          <div className="text-center mb-8">
            <h1 className="text-5xl font-bold mb-2 neon-text-purple animate-neon-pulse">
              NEON CASINO
            </h1>
            <p className="text-neon-cyan text-sm">Добро пожаловать в будущее азарта</p>
          </div>

          <Tabs value={isLogin ? 'login' : 'register'} onValueChange={(v) => setIsLogin(v === 'login')}>
            <TabsList className="grid w-full grid-cols-2 mb-6 bg-black/50">
              <TabsTrigger value="login" className="data-[state=active]:bg-neon-purple">
                Вход
              </TabsTrigger>
              <TabsTrigger value="register" className="data-[state=active]:bg-neon-cyan">
                Регистрация
              </TabsTrigger>
            </TabsList>

            <TabsContent value="login" className="space-y-4">
              <Input
                type="email"
                placeholder="Email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="bg-black/50 border-neon-purple/30 focus:border-neon-purple"
              />
              <Input
                type="password"
                placeholder="Пароль"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="bg-black/50 border-neon-purple/30 focus:border-neon-purple"
              />
              <Button
                onClick={handleAuth}
                disabled={loading}
                className="w-full bg-neon-purple hover:bg-neon-purple/80 neon-glow-purple"
              >
                {loading ? 'Загрузка...' : 'Войти'}
              </Button>
            </TabsContent>

            <TabsContent value="register" className="space-y-4">
              <Input
                type="text"
                placeholder="Имя пользователя"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="bg-black/50 border-neon-cyan/30 focus:border-neon-cyan"
              />
              <Input
                type="email"
                placeholder="Email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="bg-black/50 border-neon-cyan/30 focus:border-neon-cyan"
              />
              <Input
                type="password"
                placeholder="Пароль"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="bg-black/50 border-neon-cyan/30 focus:border-neon-cyan"
              />
              <Button
                onClick={handleAuth}
                disabled={loading}
                className="w-full bg-neon-cyan hover:bg-neon-cyan/80 neon-glow-cyan"
              >
                {loading ? 'Загрузка...' : 'Зарегистрироваться'}
              </Button>
            </TabsContent>
          </Tabs>
        </Card>
      </div>
    );
  }

  if (!currentGame) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] p-4">
        <div className="max-w-7xl mx-auto">
          <div className="glass-card border-neon-purple/30 p-6 mb-6 rounded-xl">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-3xl font-bold neon-text-purple">{user?.username}</h2>
                <p className="text-neon-cyan text-sm">{user?.email}</p>
              </div>
              <Button
                onClick={logout}
                variant="outline"
                className="border-neon-pink/30 hover:bg-neon-pink/20"
              >
                <Icon name="LogOut" size={20} className="mr-2" />
                Выход
              </Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
              <Card className="glass-card border-neon-purple/30 p-4">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-full bg-neon-purple/20 flex items-center justify-center neon-glow-purple">
                    <Icon name="Wallet" size={24} className="text-neon-purple" />
                  </div>
                  <div>
                    <p className="text-gray-400 text-sm">Баланс</p>
                    <p className="text-2xl font-bold text-white">{user?.balance.toFixed(2)}₽</p>
                  </div>
                </div>
              </Card>

              <Card className="glass-card border-neon-cyan/30 p-4">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-full bg-neon-cyan/20 flex items-center justify-center neon-glow-cyan">
                    <Icon name="Gift" size={24} className="text-neon-cyan" />
                  </div>
                  <div>
                    <p className="text-gray-400 text-sm">Бонусы</p>
                    <p className="text-2xl font-bold text-white">{user?.bonus_balance.toFixed(2)}₽</p>
                  </div>
                </div>
              </Card>
            </div>

            {bonuses.length > 0 && (
              <div className="mt-6">
                <h3 className="text-lg font-bold mb-3 neon-text-cyan">Активные бонусы</h3>
                <div className="space-y-2">
                  {bonuses.map((bonus) => (
                    <Card key={bonus.id} className="glass-card border-neon-yellow/30 p-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-semibold text-neon-yellow">{bonus.description}</p>
                          <p className="text-sm text-gray-400">{bonus.type}</p>
                        </div>
                        <p className="text-lg font-bold text-neon-yellow">+{bonus.amount}₽</p>
                      </div>
                    </Card>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="mb-6">
            <h2 className="text-2xl font-bold mb-4 neon-text-cyan">Быстрые игры</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Card
                className="glass-card border-neon-purple/30 p-6 cursor-pointer hover:scale-105 transition-transform"
                onClick={() => setCurrentGame('rocket')}
              >
                <div className="text-center">
                  <div className="text-6xl mb-3 animate-float">🚀</div>
                  <h3 className="text-2xl font-bold neon-text-purple mb-2">Ракета</h3>
                  <p className="text-gray-400 text-sm">Успей остановить до взрыва!</p>
                </div>
              </Card>

              <Card
                className="glass-card border-neon-cyan/30 p-6 cursor-pointer hover:scale-105 transition-transform"
                onClick={() => setCurrentGame('tower')}
              >
                <div className="text-center">
                  <div className="text-6xl mb-3 animate-float">🏗️</div>
                  <h3 className="text-2xl font-bold neon-text-cyan mb-2">Tower Rush</h3>
                  <p className="text-gray-400 text-sm">Строй башню и множь выигрыш!</p>
                </div>
              </Card>
            </div>
          </div>

          <div>
            <h2 className="text-2xl font-bold mb-4 neon-text-pink">Слоты</h2>
            <div className="grid grid-cols-1 gap-4">
              <Card
                className="glass-card border-neon-pink/30 p-6 cursor-pointer hover:scale-105 transition-transform"
                onClick={() => setCurrentGame('slots')}
              >
                <div className="text-center">
                  <div className="text-6xl mb-3">🎰</div>
                  <h3 className="text-2xl font-bold neon-text-pink mb-2">Классические слоты</h3>
                  <p className="text-gray-400 text-sm">Фрукты, семерки и неоновый джекпот!</p>
                </div>
              </Card>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (currentGame === 'rocket') {
    return (
      <div className="min-h-screen bg-[#0a0a0a] p-4">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center justify-between mb-6">
            <Button
              onClick={() => setCurrentGame(null)}
              variant="outline"
              className="border-neon-purple/30"
            >
              <Icon name="ArrowLeft" size={20} className="mr-2" />
              Назад
            </Button>
            <div className="text-right">
              <p className="text-sm text-gray-400">Баланс</p>
              <p className="text-2xl font-bold neon-text-purple">{user?.balance.toFixed(2)}₽</p>
            </div>
          </div>

          <Card className="glass-card border-neon-purple/30 p-8">
            <h2 className="text-3xl font-bold neon-text-purple text-center mb-8">🚀 РАКЕТА</h2>

            <div className="bg-black/50 rounded-xl p-12 mb-6 min-h-[300px] flex items-center justify-center border border-neon-purple/20">
              <div className="text-center">
                <div
                  className={`text-8xl mb-4 ${rocketActive ? 'animate-float' : ''}`}
                  style={{
                    transform: rocketActive ? `scale(${1 + rocketMultiplier * 0.1})` : 'scale(1)',
                    transition: 'transform 0.1s',
                  }}
                >
                  🚀
                </div>
                <div
                  className={`text-6xl font-bold ${
                    rocketActive ? 'neon-text-purple animate-neon-pulse' : 'text-white'
                  }`}
                >
                  x{rocketMultiplier.toFixed(1)}
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm text-gray-400 mb-2">Сумма ставки</label>
                <Input
                  type="number"
                  value={betAmount}
                  onChange={(e) => setBetAmount(Number(e.target.value))}
                  disabled={gameInProgress}
                  className="bg-black/50 border-neon-purple/30"
                />
              </div>

              <Button
                onClick={playRocket}
                disabled={gameInProgress}
                className="w-full bg-neon-purple hover:bg-neon-purple/80 neon-glow-purple text-lg py-6"
              >
                {gameInProgress ? '🚀 ПОЛЕТ...' : 'ЗАПУСТИТЬ РАКЕТУ'}
              </Button>
            </div>
          </Card>
        </div>
      </div>
    );
  }

  if (currentGame === 'tower') {
    return (
      <div className="min-h-screen bg-[#0a0a0a] p-4">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center justify-between mb-6">
            <Button
              onClick={() => {
                setCurrentGame(null);
                setGameInProgress(false);
                setTowerBlocks([]);
                setTowerLevel(1);
              }}
              variant="outline"
              className="border-neon-cyan/30"
            >
              <Icon name="ArrowLeft" size={20} className="mr-2" />
              Назад
            </Button>
            <div className="text-right">
              <p className="text-sm text-gray-400">Баланс</p>
              <p className="text-2xl font-bold neon-text-cyan">{user?.balance.toFixed(2)}₽</p>
            </div>
          </div>

          <Card className="glass-card border-neon-cyan/30 p-8">
            <h2 className="text-3xl font-bold neon-text-cyan text-center mb-8">🏗️ TOWER RUSH</h2>

            <div className="bg-black/50 rounded-xl p-8 mb-6 min-h-[400px] flex flex-col justify-end items-center border border-neon-cyan/20">
              <div className="flex flex-col-reverse gap-2 mb-6">
                {towerBlocks.map((level, idx) => (
                  <div
                    key={idx}
                    className="w-32 h-12 bg-neon-cyan/30 rounded border-2 border-neon-cyan neon-glow-cyan flex items-center justify-center font-bold"
                  >
                    Уровень {level}
                  </div>
                ))}
              </div>

              {gameInProgress && (
                <div className="text-center">
                  <p className="text-4xl font-bold neon-text-cyan mb-2">
                    Уровень {towerLevel}
                  </p>
                  <p className="text-2xl text-neon-yellow">x{towerMultiplier.toFixed(2)}</p>
                </div>
              )}

              {!gameInProgress && towerBlocks.length === 0 && (
                <p className="text-gray-500 text-center">Начните строить башню!</p>
              )}
            </div>

            <div className="space-y-4">
              {!gameInProgress ? (
                <>
                  <div>
                    <label className="block text-sm text-gray-400 mb-2">Сумма ставки</label>
                    <Input
                      type="number"
                      value={betAmount}
                      onChange={(e) => setBetAmount(Number(e.target.value))}
                      className="bg-black/50 border-neon-cyan/30"
                    />
                  </div>
                  <Button
                    onClick={startTower}
                    className="w-full bg-neon-cyan hover:bg-neon-cyan/80 neon-glow-cyan text-lg py-6"
                  >
                    НАЧАТЬ СТРОИТЬ
                  </Button>
                </>
              ) : (
                <div className="grid grid-cols-2 gap-4">
                  <Button
                    onClick={buildTowerBlock}
                    className="bg-neon-cyan hover:bg-neon-cyan/80 neon-glow-cyan text-lg py-6"
                  >
                    ДОБАВИТЬ БЛОК
                  </Button>
                  <Button
                    onClick={cashoutTower}
                    className="bg-neon-yellow hover:bg-neon-yellow/80 text-black text-lg py-6"
                  >
                    ЗАБРАТЬ {(betAmount * towerMultiplier).toFixed(2)}₽
                  </Button>
                </div>
              )}
            </div>
          </Card>
        </div>
      </div>
    );
  }

  if (currentGame === 'slots') {
    return (
      <div className="min-h-screen bg-[#0a0a0a] p-4">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center justify-between mb-6">
            <Button
              onClick={() => setCurrentGame(null)}
              variant="outline"
              className="border-neon-pink/30"
            >
              <Icon name="ArrowLeft" size={20} className="mr-2" />
              Назад
            </Button>
            <div className="text-right">
              <p className="text-sm text-gray-400">Баланс</p>
              <p className="text-2xl font-bold neon-text-pink">{user?.balance.toFixed(2)}₽</p>
            </div>
          </div>

          <Card className="glass-card border-neon-pink/30 p-8">
            <h2 className="text-3xl font-bold neon-text-pink text-center mb-8">🎰 КЛАССИЧЕСКИЕ СЛОТЫ</h2>

            <div className="bg-black/50 rounded-xl p-12 mb-6 border border-neon-pink/20">
              <div className="flex justify-center gap-4 mb-8">
                {slotReels.map((symbol, idx) => (
                  <div
                    key={idx}
                    className={`w-32 h-32 bg-gradient-to-br from-neon-pink/20 to-neon-purple/20 rounded-xl border-4 border-neon-pink flex items-center justify-center text-6xl ${
                      slotSpinning ? 'animate-spin-slow' : ''
                    } neon-glow-pink`}
                  >
                    {symbol}
                  </div>
                ))}
              </div>

              <div className="text-center">
                <p className="text-gray-400 text-sm mb-2">Таблица выплат</p>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div className="flex items-center gap-2 justify-center">
                    <span>💎💎💎</span>
                    <span className="text-neon-purple">x50</span>
                  </div>
                  <div className="flex items-center gap-2 justify-center">
                    <span>7️⃣7️⃣7️⃣</span>
                    <span className="text-neon-cyan">x20</span>
                  </div>
                  <div className="flex items-center gap-2 justify-center">
                    <span>⭐⭐⭐</span>
                    <span className="text-neon-yellow">x15</span>
                  </div>
                  <div className="flex items-center gap-2 justify-center">
                    <span>🍒🍒🍒</span>
                    <span className="text-neon-pink">x5</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm text-gray-400 mb-2">Сумма ставки</label>
                <Input
                  type="number"
                  value={betAmount}
                  onChange={(e) => setBetAmount(Number(e.target.value))}
                  disabled={gameInProgress}
                  className="bg-black/50 border-neon-pink/30"
                />
              </div>

              <Button
                onClick={spinSlots}
                disabled={gameInProgress}
                className="w-full bg-neon-pink hover:bg-neon-pink/80 neon-glow-pink text-lg py-6"
              >
                {gameInProgress ? '🎰 КРУТИМ...' : 'КРУТИТЬ БАРАБАНЫ'}
              </Button>
            </div>
          </Card>
        </div>
      </div>
    );
  }

  return null;
}
