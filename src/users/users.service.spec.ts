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
  refreshTokenHash: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

describe('UsersService', () => {
  let service: UsersService;
  const repoMock = {
    findOne: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
    update: jest.fn(),
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

  describe('findById', () => {
    it('returns the user when found', async () => {
      repoMock.findOne.mockResolvedValue(mockUser);

      const result = await service.findById('uuid-1');

      expect(result).toBe(mockUser);
      expect(repoMock.findOne).toHaveBeenCalledWith({
        where: { id: 'uuid-1' },
      });
    });

    it('returns null when not found', async () => {
      repoMock.findOne.mockResolvedValue(null);

      const result = await service.findById('unknown');

      expect(result).toBeNull();
    });
  });

  describe('updateRefreshTokenHash', () => {
    it('calls repo.update with the given id and hash', async () => {
      repoMock.update.mockResolvedValue({ affected: 1 });

      await service.updateRefreshTokenHash('uuid-1', 'abc123');

      expect(repoMock.update).toHaveBeenCalledWith('uuid-1', {
        refreshTokenHash: 'abc123',
      });
    });

    it('calls repo.update with null to clear the hash', async () => {
      repoMock.update.mockResolvedValue({ affected: 1 });

      await service.updateRefreshTokenHash('uuid-1', null);

      expect(repoMock.update).toHaveBeenCalledWith('uuid-1', {
        refreshTokenHash: null,
      });
    });
  });
});
