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
        }
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
  
  describe('findOneByDistinctId', () => {
    it('should fetch user properties from Postgres and events from Firestore', async () => {
      const mockUser = { id: 'user-uuid', distinctId: 'user-123', properties: { name: 'Test' } };
      const mockEvents = [{ id: 'evt1', data: () => ({ name: 'test_event' }) }];
      
      mockPrismaService.user.findUnique.mockResolvedValue(mockUser);
      mockFirestore.get.mockResolvedValue({ docs: mockEvents });

      await service.findOneByDistinctId('ws_id', 'user-123', 30, undefined);

      expect(mockPrismaService.user.findUnique).toHaveBeenCalledWith({
        where: { workspaceId_distinctId: { workspaceId: 'ws_id', distinctId: 'user-123' } }
      });
      
      expect(mockFirestore.collection).toHaveBeenCalledWith('users');
      expect(mockFirestore.doc).toHaveBeenCalledWith('user-uuid');
      expect(mockFirestore.collection).toHaveBeenCalledWith('events');
      expect(mockFirestore.orderBy).toHaveBeenCalledWith('timestamp', 'desc');
      expect(mockFirestore.limit).toHaveBeenCalledWith(30);
    });
  });
});
