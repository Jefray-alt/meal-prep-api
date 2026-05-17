import { getRepositoryToken } from '@nestjs/typeorm';
import { Test } from '@nestjs/testing';
import { User } from './user.entity';
import { UsersService } from './users.service';

const mockUser: User = {
  id: 'uuid-1',
  firstName: 'Jane',
  lastName: 'Doe',
  email: 'jane@example.com',
  passwordHash: 'hashed',
  createdAt: new Date(),
  updatedAt: new Date(),
};

describe('UsersService', () => {
  let service: UsersService;
  const repoMock = {
    findOne: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
  };

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        UsersService,
        { provide: getRepositoryToken(User), useValue: repoMock },
      ],
    }).compile();

    service = module.get(UsersService);
    jest.clearAllMocks();
  });

  describe('findByEmail', () => {
    it('returns the user when found', async () => {
      repoMock.findOne.mockResolvedValue(mockUser);
      const result = await service.findByEmail('jane@example.com');
      expect(result).toBe(mockUser);
      expect(repoMock.findOne).toHaveBeenCalledWith({
        where: { email: 'jane@example.com' },
      });
    });

    it('returns null when not found', async () => {
      repoMock.findOne.mockResolvedValue(null);
      const result = await service.findByEmail('nobody@example.com');
      expect(result).toBeNull();
    });
  });

  describe('create', () => {
    it('persists and returns the new user', async () => {
      repoMock.create.mockReturnValue(mockUser);
      repoMock.save.mockResolvedValue(mockUser);

      const result = await service.create({
        firstName: 'Jane',
        lastName: 'Doe',
        email: 'jane@example.com',
        passwordHash: 'hashed',
      });

      expect(repoMock.create).toHaveBeenCalledWith({
        firstName: 'Jane',
        lastName: 'Doe',
        email: 'jane@example.com',
        passwordHash: 'hashed',
      });
      expect(repoMock.save).toHaveBeenCalledWith(mockUser);
      expect(result).toBe(mockUser);
    });
  });
});
