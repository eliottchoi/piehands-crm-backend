import { Test, TestingModule } from '@nestjs/testing';
import { UsersService } from './users.service';
import { PrismaService } from '../prisma/prisma.service';
import { FIRESTORE } from '../firebase/firebase.module';

const mockPrismaService = {
  user: {
    findUnique: jest.fn(),
  },
};

const mockFirestore = {
  collection: jest.fn().mockReturnThis(),
  doc: jest.fn().mockReturnThis(),
  orderBy: jest.fn().mockReturnThis(),
  limit: jest.fn().mockReturnThis(),
  startAfter: jest.fn().mockReturnThis(),
  get: jest.fn(),
};

describe('UsersService', () => {
  let service: UsersService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
        {
          provide: FIRESTORE,
          useValue: mockFirestore,
        },
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('findOneByDistinctId', () => {
    it('should return user with events and compute next token', async () => {
      const mockUser = {
        id: 'user-uuid',
        distinctId: 'user-123',
        properties: { name: 'Test' },
        events: [{ id: 'evt-1' }, { id: 'evt-2' }],
      };

      mockPrismaService.user.findUnique.mockResolvedValue(mockUser);

      const result = await service.findOneByDistinctId(
        'ws_id',
        'user-123',
        2,
        undefined,
      );

      expect(mockPrismaService.user.findUnique).toHaveBeenCalledWith({
        where: {
          workspaceId_distinctId: {
            workspaceId: 'ws_id',
            distinctId: 'user-123',
          },
        },
        include: {
          events: {
            orderBy: { timestamp: 'desc' },
            take: 2,
          },
        },
      });

      expect(result.events).toEqual(mockUser.events);
      expect(result.nextEventToken).toEqual('evt-2');
    });
  });
});
